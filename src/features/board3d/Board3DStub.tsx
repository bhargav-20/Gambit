/**
 * Placeholder 3D board. Will be replaced with a proper @react-three/fiber scene
 * (board mesh + procedural Staunton pieces + lighting/shadows). The UI toggle
 * already exists in ThemePanel; this stub lets us validate the wiring.
 */
import { Box } from 'lucide-react';

export function Board3DStub() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 panel">
      <Box size={48} className="text-accent mb-3" />
      <h3 className="font-display text-xl mb-1">3D Mode — coming soon</h3>
      <p className="text-sm text-ink-muted max-w-xs">
        Procedural Staunton pieces with PBR materials and dynamic lighting via React-Three-Fiber.
        Switch back to <span className="text-accent">2D</span> in Theme &amp; Display to play.
      </p>
    </div>
  );
}
