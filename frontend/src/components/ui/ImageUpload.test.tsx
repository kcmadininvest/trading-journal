import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageUpload from './ImageUpload';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ImageUpload delete interception', () => {
  it('requests confirmation before deleting a hosted image', async () => {
    const onRequestDelete = vi.fn();
    const deleteFunction = vi.fn(async () => ({ message: 'deleted' }));
    const onRemove = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('preview unavailable')));

    render(
      <ImageUpload
        value="/media/test-screenshot.png"
        onUpload={vi.fn()}
        onRemove={onRemove}
        uploadFunction={vi.fn()}
        deleteFunction={deleteFunction}
        onRequestDelete={onRequestDelete}
      />,
    );

    const removeButton = await screen.findByRole('button', { name: 'Supprimer' });
    fireEvent.click(removeButton);

    await waitFor(() => expect(onRequestDelete).toHaveBeenCalledWith('/media/test-screenshot.png'));
    expect(deleteFunction).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('keeps the direct removal behavior for an external URL', () => {
    const onRequestDelete = vi.fn();
    const deleteFunction = vi.fn(async () => ({ message: 'deleted' }));
    const onRemove = vi.fn();

    render(
      <ImageUpload
        value="https://images.example.test/screenshot.png"
        onUpload={vi.fn()}
        onRemove={onRemove}
        uploadFunction={vi.fn()}
        deleteFunction={deleteFunction}
        onRequestDelete={onRequestDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRequestDelete).not.toHaveBeenCalled();
    expect(deleteFunction).not.toHaveBeenCalled();
  });
});

describe('ImageUpload late upload guard', () => {
  const uploadResponse = {
    original_url: '/media/screenshots/1/2026/09/late.webp',
    thumbnail_url: '/media/screenshots/1/2026/09/late_thumb.webp',
  };

  const selectFile = (container: HTMLElement) => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'shot.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
  };

  it('deletes the uploaded file instead of calling onUpload when unmounted before completion', async () => {
    let resolveUpload: (value: typeof uploadResponse) => void = () => undefined;
    const uploadFunction = vi.fn(
      () => new Promise<typeof uploadResponse>((resolve) => { resolveUpload = resolve; }),
    );
    const deleteFunction = vi.fn(async () => ({ message: 'deleted' }));
    const onUpload = vi.fn();

    const { container, unmount } = render(
      <ImageUpload
        onUpload={onUpload}
        onRemove={vi.fn()}
        uploadFunction={uploadFunction}
        deleteFunction={deleteFunction}
      />,
    );

    selectFile(container);
    await waitFor(() => expect(uploadFunction).toHaveBeenCalledOnce());

    unmount();
    resolveUpload(uploadResponse);

    await waitFor(() => expect(deleteFunction).toHaveBeenCalledWith(uploadResponse.original_url));
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('calls onUpload and keeps the file when still mounted', async () => {
    const uploadFunction = vi.fn(async () => uploadResponse);
    const deleteFunction = vi.fn(async () => ({ message: 'deleted' }));
    const onUpload = vi.fn();

    const { container } = render(
      <ImageUpload
        onUpload={onUpload}
        onRemove={vi.fn()}
        uploadFunction={uploadFunction}
        deleteFunction={deleteFunction}
      />,
    );

    selectFile(container);

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith({
      original: uploadResponse.original_url,
      thumbnail: uploadResponse.thumbnail_url,
    }));
    expect(deleteFunction).not.toHaveBeenCalled();
  });
});
