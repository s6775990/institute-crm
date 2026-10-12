// Behavioural tests for the data layer: permissions, validation and key flows.
// Run with: npm test

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { AppError } from '../src/core/errors.ts';
import { LocalDataService } from '../src/data/local/LocalDataService.ts';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../src/data/local/seed.ts';
import { MemoryBlobStore, MemoryKeyValueStore } from '../src/data/local/storage.ts';

const [MANAGER, MICHAL, NOA] = DEMO_ACCOUNTS.map((a) => a.email);

async function rejectsWith(promise: Promise<unknown>, code: AppError['code']) {
  await assert.rejects(promise, (err: unknown) => err instanceof AppError && err.code === code);
}

let svc: LocalDataService;
let clock: Date;

beforeEach(async () => {
  clock = new Date('2026-10-12T09:00:00Z');
  svc = await LocalDataService.create({
    kv: new MemoryKeyValueStore(),
    blobs: new MemoryBlobStore(),
    now: () => clock,
  });
});

const as = (email: string) => svc.signIn(email, DEMO_PASSWORD);

describe('authentication', () => {
  it('rejects a wrong password with a generic message', async () => {
    await rejectsWith(svc.signIn(MANAGER, 'wrong-password'), 'invalid_credentials');
    await rejectsWith(svc.signIn('nobody@demo.co.il', 'whatever1'), 'invalid_credentials');
  });

  it('locks the account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) await rejectsWith(svc.signIn(MICHAL, 'bad-pass'), 'invalid_credentials');
    await rejectsWith(as(MICHAL), 'forbidden');
    clock = new Date(clock.getTime() + 6 * 60_000);
    await as(MICHAL);
  });

  it('expires the session after 30 idle minutes', async () => {
    await as(MANAGER);
    assert.ok(await svc.getSession());
    clock = new Date(clock.getTime() + 31 * 60_000);
    assert.equal(await svc.getSession(), null);
    await rejectsWith(svc.listClients({ status: 'all' }), 'unauthenticated');
  });

  it('requires sign-in for every call', async () => {
    await rejectsWith(svc.listClients({ status: 'all' }), 'unauthenticated');
    await rejectsWith(svc.listLeads({ view: 'all' }), 'unauthenticated');
  });
});

describe('client visibility', () => {
  it('a counselor sees only her own clients', async () => {
    await as(MICHAL);
    const mine = await svc.listClients({ status: 'all' });
    const me = (await svc.getSession())!.user;
    assert.ok(mine.length > 0);
    assert.ok(mine.every((c) => c.counselorId === me.id));
  });

  it("a counselor cannot open, edit or read content of another counselor's client", async () => {
    await as(NOA);
    const noaClient = (await svc.listClients({ status: 'all' }))[0];
    await svc.signOut();
    await as(MICHAL);
    await rejectsWith(svc.getClient(noaClient.id), 'not_found');
    await rejectsWith(svc.listMeetings(noaClient.id), 'not_found');
    await rejectsWith(svc.listActivities({ clientId: noaClient.id }), 'not_found');
    await rejectsWith(svc.listAssessments(noaClient.id), 'not_found');
    await rejectsWith(svc.listTasks({ clientId: noaClient.id }), 'not_found');
    await rejectsWith(svc.addActivity({ clientId: noaClient.id }, { kind: 'note', content: 'x', occurredAt: clock.toISOString() }), 'not_found');
    await rejectsWith(svc.setClientStage(noaClient.id, null), 'not_found');
  });

  it('a counselor cannot see leads, staff management or settings changes', async () => {
    await as(MICHAL);
    await rejectsWith(svc.listLeads({ view: 'all' }), 'forbidden');
    await rejectsWith(svc.createStaff({ fullName: '׳‘׳“׳™׳§׳”', email: 'x@y.co', phone: '', role: 'admin' }), 'forbidden');
    await rejectsWith(svc.addLookupItem('leadSources', { name: '׳—׳“׳©' }), 'forbidden');
    await rejectsWith(svc.listAudit(10), 'forbidden');
    const client = (await svc.listClients({ status: 'all' }))[0];
    const staff = await svc.listStaff();
    await rejectsWith(svc.assignClient(client.id, staff[0].id), 'forbidden');
    await rejectsWith(svc.archiveClient(client.id), 'forbidden');
  });

  it('the manager sees all clients', async () => {
    await as(MANAGER);
    const all = await svc.listClients({ status: 'all' });
    assert.equal(all.length, 4);
  });
});

describe('lead to client conversion', () => {
  it('creates a client, assigns it and notifies the counselor', async () => {
    const manager = (await as(MANAGER)).user;
    const michal = (await svc.listStaff()).find((s) => s.email === MICHAL)!;
    const lead = (await svc.listLeads({ view: 'open' }))[0];
    const client = await svc.convertLead(lead.id, { counselorId: michal.id, stageId: null, noteForCounselor: '׳—׳©׳•׳‘ ׳׳“׳¢׳×' });
    assert.equal(client.counselorId, michal.id);
    assert.equal(client.leadId, lead.id);
    assert.equal(client.createdBy, manager.id);
    await rejectsWith(svc.convertLead(lead.id, { counselorId: michal.id, stageId: null, noteForCounselor: '' }), 'conflict');
    assert.ok((await svc.listLeads({ view: 'converted' })).some((l) => l.id === lead.id));

    await svc.signOut();
    await as(MICHAL);
    const notes = await svc.listNotifications();
    assert.ok(notes.some((n) => n.clientId === client.id && !n.readAt));
    assert.equal((await svc.getClient(client.id)).background, '׳—׳©׳•׳‘ ׳׳“׳¢׳×');
  });

  it('reassigning moves access to the new counselor', async () => {
    await as(MANAGER);
    const staff = await svc.listStaff();
    const noa = staff.find((s) => s.email === NOA)!;
    const michalClient = (await svc.listClients({ status: 'all' })).find((c) => c.counselorId !== noa.id)!;
    await svc.assignClient(michalClient.id, noa.id);
    await svc.signOut();
    await as(MICHAL);
    await rejectsWith(svc.getClient(michalClient.id), 'not_found');
    await svc.signOut();
    await as(NOA);
    assert.equal((await svc.getClient(michalClient.id)).id, michalClient.id);
  });
});

describe('validation', () => {
  it('rejects a lead without any contact details', async () => {
    await as(MANAGER);
    await assert.rejects(
      svc.createLead({ fullName: '׳׳׳ ׳₪׳¨׳˜׳™׳', phone: '', email: '', sourceId: null, inquiry: '' }),
      (err: unknown) => err instanceof AppError && err.code === 'validation' && 'phone' in err.fieldErrors,
    );
  });

  it('rejects invalid phone and email', async () => {
    await as(MANAGER);
    await assert.rejects(
      svc.createLead({ fullName: '׳‘׳“׳™׳§׳”', phone: '12', email: 'not-an-email', sourceId: null, inquiry: '' }),
      (err: unknown) => err instanceof AppError && 'phone' in err.fieldErrors && 'email' in err.fieldErrors,
    );
  });

  it('detects duplicates by phone', async () => {
    await as(MANAGER);
    const lead = (await svc.listLeads({ view: 'open' }))[0];
    const dups = await svc.findDuplicates(lead.phone!.replace(/^(\d{3})/, '$1-'), '');
    assert.ok(dups.some((d) => d.id === lead.id));
  });
});

describe('staff management', () => {
  it('new staff must change the temporary password', async () => {
    await as(MANAGER);
    const { tempPassword } = await svc.createStaff({ fullName: '׳™׳•׳¢׳¦׳× ׳—׳“׳©׳”', email: 'new@demo.co.il', phone: '', role: 'counselor' });
    assert.match(tempPassword, /^\d{8}$/);
    await svc.signOut();
    const session = await svc.signIn('new@demo.co.il', tempPassword);
    assert.equal(session.user.mustChangePassword, true);
    await svc.changePassword('a-new-pass', 'a-new-pass');
    assert.equal((await svc.getSession())!.user.mustChangePassword, false);
  });

  it('a disabled account cannot sign in', async () => {
    await as(MICHAL);
    const michalId = (await svc.getSession())!.user.id;
    await svc.signOut();
    await as(MANAGER);
    await svc.setStaffActive(michalId, false);
    await svc.signOut();
    await rejectsWith(as(MICHAL), 'account_disabled');
  });

  it('cannot remove the last active admin', async () => {
    const manager = (await as(MANAGER)).user;
    await rejectsWith(svc.setStaffActive(manager.id, false), 'forbidden');
    await rejectsWith(svc.updateStaff(manager.id, { fullName: manager.fullName, email: manager.email, phone: '', role: 'counselor' }), 'forbidden');
  });
});

describe('tasks', () => {
  it('a counselor can only create tasks for herself', async () => {
    await as(MICHAL);
    const staff = await svc.listStaff();
    const noa = staff.find((s) => s.email === NOA)!;
    await rejectsWith(svc.addTask(null, { title: '׳‘׳“׳™׳§׳”', dueDate: '', assigneeId: noa.id }), 'forbidden');
    await svc.addTask(null, { title: '׳׳©׳™׳׳” ׳©׳׳™', dueDate: '2026-10-13' });
    assert.ok((await svc.listTasks({})).some((t) => t.title === '׳׳©׳™׳׳” ׳©׳׳™'));
  });

  it("a counselor cannot list another person's tasks", async () => {
    await as(MICHAL);
    await rejectsWith(svc.listTasks({ assigneeId: 'all' }), 'forbidden');
  });
});
