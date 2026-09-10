let registration: ServiceWorkerRegistration | null = null;
let resolveReady: ((reg: ServiceWorkerRegistration) => void) | null = null;

const ready = new Promise<ServiceWorkerRegistration | null>((resolve) => {
  resolveReady = (reg) => {
    registration = reg;
    resolve(reg);
  };
  if (!("serviceWorker" in navigator)) {
    resolve(null);
    resolveReady = null;
  }
});

export function setServiceWorkerRegistration(next: ServiceWorkerRegistration): void {
  registration = next;
  resolveReady?.(next);
  resolveReady = null;
}

export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

export function whenServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return Promise.resolve(registration);
  return ready;
}
