// Lets any part of the app report that the session ended (e.g. a call failed with
// "unauthenticated") without depending on the auth provider directly.

type Listener = () => void;
const listeners = new Set<Listener>();

export const authEvents = {
  onExpired(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  expired() {
    listeners.forEach((l) => l());
  },
};
