/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../ui/Toast.js";
import { setServiceWorkerRegistration, whenServiceWorkerReady } from "./sw-registration.js";
import { UpdatePrompt, UpdatePromptProvider } from "./UpdatePrompt.js";

const toastInfo = vi.fn();

vi.mock("../ui/Toast.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../ui/Toast.js")>();
  return {
    ...orig,
    useToast: () => ({
      show: vi.fn(),
      info: toastInfo,
      success: vi.fn(),
      error: vi.fn(),
    }),
  };
});

vi.mock("./sw-registration.js", () => ({
  getServiceWorkerRegistration: vi.fn(),
  whenServiceWorkerReady: vi.fn(),
  setServiceWorkerRegistration: vi.fn(),
}));

function mockWaitingWorker(): ServiceWorker {
  const listeners = new Map<string, Set<() => void>>();
  return {
    state: "installed",
    postMessage: vi.fn(),
    addEventListener: (type: string, listener: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: vi.fn(),
  } as unknown as ServiceWorker;
}

function renderPrompt(options: { unattended?: boolean; isTableIdle?: boolean } = {}) {
  const { unattended = false, isTableIdle = true } = options;
  return render(
    <ToastProvider>
      <UpdatePromptProvider unattended={unattended} isTableIdle={isTableIdle}>
        <UpdatePrompt />
      </UpdatePromptProvider>
    </ToastProvider>,
  );
}

describe("UpdatePrompt", () => {
  beforeEach(() => {
    toastInfo.mockReset();
    vi.useFakeTimers();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function mockRegistration(waiting: ServiceWorker): ServiceWorkerRegistration {
    return {
      waiting,
      installing: null,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;
  }

  it("shows toast and reload button when not unattended", async () => {
    const waiting = mockWaitingWorker();
    vi.mocked(whenServiceWorkerReady).mockResolvedValue(mockRegistration(waiting));
    vi.mocked(setServiceWorkerRegistration).mockImplementation((registration) => {
      void registration;
    });

    renderPrompt();

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastInfo).toHaveBeenCalledWith(
      "New version available — Reload",
      expect.objectContaining({ testId: "pwa-update-toast" }),
    );
    expect(screen.getByTestId("pwa-reload-btn")).toBeTruthy();
  });

  it("auto-reloads after 30s idle when unattended", async () => {
    const waiting = mockWaitingWorker();
    const registration = mockRegistration(waiting);
    vi.mocked(whenServiceWorkerReady).mockResolvedValue(registration);
    vi.mocked(setServiceWorkerRegistration).mockImplementation(() => {});
    const { getServiceWorkerRegistration } = await import("./sw-registration.js");
    vi.mocked(getServiceWorkerRegistration).mockReturnValue(registration);

    renderPrompt({ unattended: true, isTableIdle: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(toastInfo).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pwa-reload-btn")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("does not auto-reload when unattended but table is not idle", async () => {
    const waiting = mockWaitingWorker();
    vi.mocked(whenServiceWorkerReady).mockResolvedValue(mockRegistration(waiting));

    renderPrompt({ unattended: true, isTableIdle: false });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(waiting.postMessage).not.toHaveBeenCalled();
  });
});
