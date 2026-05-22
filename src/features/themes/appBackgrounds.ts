import type { AppBackgroundId } from '@/core/store/uiStore';

/**
 * One entry per AppBackgroundId. `base` is the body's background-color;
 * `image` is the background-image CSS value (gradients / patterns) layered
 * over the base. All four options are pure CSS — no images, no animations,
 * negligible cost. Each tweaks the base color slightly so the overlay
 * doesn't look pasted on top of an unrelated black.
 */
export interface AppBackground {
  id: AppBackgroundId;
  label: string;
  description: string;
  base: string;
  image: string;
  /** Tiny preview swatch CSS shown in the Settings panel — typically a
   *  scaled-down version of the same gradients. */
  previewImage: string;
  /** Optional background-size for tiled patterns (checkered). */
  size?: string;
  previewSize?: string;
}

export const APP_BACKGROUNDS: AppBackground[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Quiet radial gradients on near-black. The default — editorial and calm.',
    base: '#0b0d12',
    image: [
      'radial-gradient(1200px 600px at 80% -10%, rgba(233,180,101,0.08), transparent 60%)',
      'radial-gradient(900px 500px at 10% 110%, rgba(110,140,200,0.06), transparent 60%)',
    ].join(', '),
    previewImage: [
      'radial-gradient(60px 40px at 80% -10%, rgba(233,180,101,0.4), transparent 60%)',
      'radial-gradient(50px 35px at 10% 110%, rgba(110,140,200,0.3), transparent 60%)',
    ].join(', '),
  },
  {
    id: 'checkered',
    label: 'Checkered',
    description: 'Subtle chessboard pattern. You have to look to see it.',
    base: '#0b0d12',
    image: 'repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%)',
    size: '80px 80px',
    previewImage: 'repeating-conic-gradient(rgba(255,255,255,0.15) 0% 25%, transparent 0% 50%)',
    previewSize: '20px 20px',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Mesh of violet, teal, and pink — modern thinking-sandbox feel.',
    base: '#0a0c18',
    image: [
      'radial-gradient(900px 700px at 15% -10%, rgba(140,80,200,0.35), transparent 60%)',
      'radial-gradient(800px 600px at 90% 30%, rgba(50,180,200,0.28), transparent 60%)',
      'radial-gradient(700px 600px at 10% 95%, rgba(220,100,160,0.22), transparent 60%)',
    ].join(', '),
    previewImage: [
      'radial-gradient(60px 40px at 15% -10%, rgba(140,80,200,0.55), transparent 60%)',
      'radial-gradient(55px 35px at 90% 30%, rgba(50,180,200,0.45), transparent 60%)',
      'radial-gradient(50px 35px at 10% 95%, rgba(220,100,160,0.35), transparent 60%)',
    ].join(', '),
  },
  {
    id: 'wood',
    label: 'Wood Study',
    description: 'Warm amber and umber. Wooden tournament set under warm light.',
    base: '#16110b',
    image: [
      'radial-gradient(1200px 700px at 30% 20%, rgba(200,140,70,0.22), transparent 60%)',
      'radial-gradient(900px 600px at 75% 85%, rgba(140,80,30,0.22), transparent 60%)',
      'linear-gradient(90deg, rgba(80,50,20,0.06), transparent 30%, transparent 70%, rgba(80,50,20,0.06))',
    ].join(', '),
    previewImage: [
      'radial-gradient(60px 40px at 30% 20%, rgba(200,140,70,0.5), transparent 60%)',
      'radial-gradient(55px 40px at 75% 85%, rgba(140,80,30,0.5), transparent 60%)',
    ].join(', '),
  },
];

export function findAppBackground(id: AppBackgroundId): AppBackground {
  return APP_BACKGROUNDS.find((b) => b.id === id) ?? APP_BACKGROUNDS[0];
}
