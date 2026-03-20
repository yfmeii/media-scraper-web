import { afterEach, describe, expect, mock, test } from 'bun:test';
import { copyPath, detailDelay, getFanartUrl } from './mediaDetail';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  if (navigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  } else {
    delete (globalThis as { navigator?: Navigator }).navigator;
  }

  if (documentDescriptor) {
    Object.defineProperty(globalThis, 'document', documentDescriptor);
  } else {
    delete (globalThis as { document?: Document }).document;
  }
});

describe('mediaDetail helpers', () => {
  test('builds animation delay and fanart URL', () => {
    expect(detailDelay(0)).toBe(200);
    expect(detailDelay(3, 50, 150)).toBe(300);

    expect(getFanartUrl()).toBeUndefined();
    expect(getFanartUrl('/media/TV/Test Show', false)).toBeUndefined();
    expect(getFanartUrl('/media/TV/Test Show', true)).toBe(
      '/api/media/poster?path=%2Fmedia%2FTV%2FTest%20Show%2Ffanart.jpg',
    );
  });

  test('copies path through clipboard when available', () => {
    const writeText = mock(() => Promise.resolve());
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    copyPath('/tmp/media/file.mkv');

    expect(writeText).toHaveBeenCalledWith('/tmp/media/file.mkv');
  });

  test('falls back to textarea copy when clipboard is unavailable', () => {
    let selected = false;
    let execCommand = '';
    const textarea = {
      value: '',
      style: {},
      setAttribute: mock(() => {}),
      select: mock(() => {
        selected = true;
      }),
    };
    const appendChild = mock(() => {});
    const removeChild = mock(() => {});

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: mock(() => textarea),
        body: {
          appendChild,
          removeChild,
        },
        execCommand: mock((command: string) => {
          execCommand = command;
          return true;
        }),
      },
    });

    copyPath('/tmp/fallback/file.mkv');

    expect(textarea.value).toBe('/tmp/fallback/file.mkv');
    expect(selected).toBe(true);
    expect(execCommand).toBe('copy');
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
  });
});
