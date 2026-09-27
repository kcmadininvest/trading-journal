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
