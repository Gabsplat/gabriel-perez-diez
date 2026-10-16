import { animate } from 'animejs';

// Hoja de contacto de Labs. Un fotograma se agranda como con una lupa cuando
// se lo señala (mouse), se enfoca (teclado) o se toca (touch). El host recibe
// el lab resaltado para cambiar la letra grande, o null cuando no hay ninguno.

export interface LabSelection {
  id: string;
  shape: string;
}

export function setupLabs(root: HTMLElement, onSelect: (lab: LabSelection | null) => void): void {
  const sheet = root.querySelector<HTMLElement>('[data-sheet]');
  const frames = [...root.querySelectorAll<HTMLElement>('[data-frame]')];
  const notes = [...root.querySelectorAll<HTMLElement>('[data-note]')];
  const hint = root.querySelector<HTMLElement>('[data-hint]');
  if (!sheet || frames.length === 0) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = -1;
  // En touch: `false` si el toque fue sobre un fotograma que todavía no estaba resaltado
  let tapWasActive: boolean | null = null;

  const hasKeyboardFocus = () => {
    const el = document.activeElement;
    return !!el && root.contains(el) && el.matches(':focus-visible');
  };

  function select(i: number) {
    if (i === active) return;
    active = i;
    sheet!.classList.add('has-active');
    frames.forEach((frame, j) => {
      const on = j === i;
      frame.classList.toggle('is-active', on);
      if (on) frame.setAttribute('aria-current', 'true');
      else frame.removeAttribute('aria-current');
    });
    notes.forEach((note, j) => {
      note.hidden = j !== i;
    });
    if (hint) hint.hidden = true;
    if (!still && notes[i]) {
      animate(notes[i], { opacity: [0, 1], translateY: [6, 0], duration: 380, ease: 'outQuad' });
    }
    onSelect({ id: frames[i].dataset.labId!, shape: frames[i].dataset.shape! });
  }

  function clear() {
    if (active < 0) return;
    active = -1;
    sheet!.classList.remove('has-active');
    frames.forEach((frame) => {
      frame.classList.remove('is-active');
      frame.removeAttribute('aria-current');
    });
    notes.forEach((note) => {
      note.hidden = true;
    });
    if (hint) hint.hidden = false;
    onSelect(null);
  }

  frames.forEach((frame, i) => {
    // Mouse: resaltar al pasar por encima
    frame.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') select(i);
    });

    // Touch: el primer toque solo resalta; el segundo sigue el enlace
    frame.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        tapWasActive = null;
        return;
      }
      tapWasActive = i === active;
      if (!tapWasActive) select(i);
    });

    frame.addEventListener('click', (e) => {
      const skipNavigation = tapWasActive === false && e.detail > 0 && frame instanceof HTMLAnchorElement;
      tapWasActive = null;
      if (skipNavigation) e.preventDefault();
    });

    frame.addEventListener('focus', () => select(i));
  });

  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !hasKeyboardFocus()) clear();
  });

  root.addEventListener('focusout', (e) => {
    const next = e.relatedTarget;
    if (!(next instanceof Node) || !root.contains(next)) clear();
  });

  // Toque fuera del componente: se suelta la selección
  document.addEventListener('pointerdown', (e) => {
    if (!root.contains(e.target as Node)) clear();
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clear();
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    const current = frames.indexOf(e.target as HTMLElement);
    if (current < 0) return;

    const cols = getComputedStyle(sheet!).gridTemplateColumns.split(' ').length;
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current + cols,
      ArrowUp: current - cols,
      Home: 0,
      End: frames.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = Math.min(frames.length - 1, Math.max(0, moves[e.key]));
    frames[next].focus();
  });

  onSelect(null);
}
