import { describe, expect, it } from 'vitest';
import { assetUrl } from '../assetUrl.ts';
import { BG_TITLE, JIGSAW_IMAGES, SCENE_PROPS, travelerSpriteSrc } from '../../data/media.ts';
import { ROOM_TYPES, ROOMS } from '../../data/rooms.ts';

const PATH = '/source/props/prop-firepit.webp';

describe('assetUrl (public files at any deploy location)', () => {
  it('keeps root-absolute paths for root hosting and the dev server', () => {
    expect(assetUrl(PATH, '/')).toBe('/source/props/prop-firepit.webp');
  });

  it('resolves against a relative build base', () => {
    expect(assetUrl(PATH, './')).toBe('./source/props/prop-firepit.webp');
  });

  it('prefixes a sub-path base such as GitHub Pages (with or without its trailing slash)', () => {
    expect(assetUrl(PATH, '/One-Warm-Spot/')).toBe('/One-Warm-Spot/source/props/prop-firepit.webp');
    expect(assetUrl(PATH, '/One-Warm-Spot')).toBe('/One-Warm-Spot/source/props/prop-firepit.webp');
  });

  it('accepts paths without a leading slash or with ./, and never doubles slashes', () => {
    expect(assetUrl('source/ui/logo-title.webp', '/One-Warm-Spot/')).toBe('/One-Warm-Spot/source/ui/logo-title.webp');
    expect(assetUrl('./source/ui/logo-title.webp', './')).toBe('./source/ui/logo-title.webp');
    expect(assetUrl('//source/x.webp', '/')).toBe('//source/x.webp');
    expect(assetUrl('/source/x.webp', '')).toBe('/source/x.webp');
  });

  it('leaves complete URLs alone', () => {
    for (const url of ['https://cdn.example.com/a.webp', 'data:image/png;base64,AAAA', 'blob:https://x/1', '//cdn.example.com/a.webp']) {
      expect(assetUrl(url, '/One-Warm-Spot/')).toBe(url);
    }
  });

  it('routes every game asset through the build base (tests run with base "/")', () => {
    const all = [
      BG_TITLE.src,
      travelerSpriteSrc('female', 'idle'),
      ...Object.values(SCENE_PROPS),
      ...JIGSAW_IMAGES.map((i) => i.src),
      ...ROOM_TYPES.flatMap((t) => [ROOMS[t].shell, ...ROOMS[t].props.map((p) => p.src)]),
    ];
    for (const src of all) expect(src, src).toMatch(/^\/source\/[^/].*\.webp$/);
  });
});
