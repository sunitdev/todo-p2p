import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { Rocket } from 'lucide-react';
import { ProgressIcon } from '../../src/components/ProgressIcon';

afterEach(cleanup);

/**
 * The ring's filled arc is the second <circle> inside the inline <svg>; the
 * first is the track. Both share `cx="50"` / `cy="50"` in a 100x100 viewBox.
 */
function getArc(container: HTMLElement): SVGCircleElement {
  const circles = container.querySelectorAll('svg circle');
  expect(circles.length).toBe(2);
  return circles[1] as SVGCircleElement;
}

describe('ProgressIcon', () => {
  describe('progress rendering', () => {
    test('exposes the rounded percentage via aria-label + data-progress', () => {
      render(<ProgressIcon progress={0} color="blue" inner={{ kind: 'dot' }} />);
      const node = screen.getByRole('img', { name: 'Progress 0%' });
      expect(node.getAttribute('data-progress')).toBe('0');
    });

    test('renders 50% progress with the correct aria-label', () => {
      render(<ProgressIcon progress={0.5} color="green" inner={{ kind: 'dot' }} />);
      expect(screen.getByRole('img', { name: 'Progress 50%' })).toBeInTheDocument();
    });

    test('renders 100% progress with the correct aria-label', () => {
      render(<ProgressIcon progress={1} color="purple" inner={{ kind: 'dot' }} />);
      expect(screen.getByRole('img', { name: 'Progress 100%' })).toBeInTheDocument();
    });

    test('clamps values above 1 down to 100%', () => {
      render(<ProgressIcon progress={3.7} color="red" inner={{ kind: 'dot' }} />);
      expect(screen.getByRole('img', { name: 'Progress 100%' })).toBeInTheDocument();
    });

    test('clamps negative values up to 0%', () => {
      render(<ProgressIcon progress={-0.4} color="red" inner={{ kind: 'dot' }} />);
      expect(screen.getByRole('img', { name: 'Progress 0%' })).toBeInTheDocument();
    });

    test('treats NaN as 0%', () => {
      render(<ProgressIcon progress={Number.NaN} color="red" inner={{ kind: 'dot' }} />);
      expect(screen.getByRole('img', { name: 'Progress 0%' })).toBeInTheDocument();
    });
  });

  describe('arc geometry', () => {
    test('arc starts fully hidden (dashoffset = dasharray) on first paint', () => {
      // We start at displayed=0 regardless of target so the CSS transition has
      // a baseline to play from. The asserted state is the synchronous first
      // render, before the rAF that sets displayed -> target.
      const { container } = render(
        <ProgressIcon progress={0.75} color="blue" inner={{ kind: 'dot' }} />,
      );
      const arc = getArc(container);
      const dasharray = Number(arc.getAttribute('stroke-dasharray'));
      const dashoffset = Number(arc.getAttribute('stroke-dashoffset'));
      expect(Number.isFinite(dasharray)).toBe(true);
      expect(dasharray).toBeGreaterThan(0);
      expect(dashoffset).toBeCloseTo(dasharray, 5);
    });

    test('arc carries the transition class for stroke-dashoffset', () => {
      const { container } = render(
        <ProgressIcon progress={0.5} color="blue" inner={{ kind: 'dot' }} />,
      );
      const arc = getArc(container);
      expect(arc.getAttribute('class') ?? '').toContain('progress-ring');
    });
  });

  describe('sizes', () => {
    test('sm uses size-4 (16px)', () => {
      const { container } = render(
        <ProgressIcon size="sm" progress={0.5} color="blue" inner={{ kind: 'dot' }} />,
      );
      const root = container.firstElementChild;
      expect(root?.className ?? '').toContain('size-4');
    });

    test('md uses size-6 (24px)', () => {
      const { container } = render(
        <ProgressIcon size="md" progress={0.5} color="blue" inner={{ kind: 'dot' }} />,
      );
      const root = container.firstElementChild;
      expect(root?.className ?? '').toContain('size-6');
    });

    test('lg uses size-8 (32px)', () => {
      const { container } = render(
        <ProgressIcon size="lg" progress={0.5} color="blue" inner={{ kind: 'dot' }} />,
      );
      const root = container.firstElementChild;
      expect(root?.className ?? '').toContain('size-8');
    });

    test('default size is sm when omitted', () => {
      const { container } = render(
        <ProgressIcon progress={0.5} color="blue" inner={{ kind: 'dot' }} />,
      );
      const root = container.firstElementChild;
      expect(root?.className ?? '').toContain('size-4');
    });
  });

  describe('inner content', () => {
    test('emoji inner renders the literal character', () => {
      render(
        <ProgressIcon progress={0.5} color="blue" inner={{ kind: 'emoji', value: '🚀' }} />,
      );
      expect(screen.getByText('🚀')).toBeInTheDocument();
    });

    test('icon inner renders the lucide component', () => {
      const { container } = render(
        <ProgressIcon progress={0.5} color="blue" inner={{ kind: 'icon', lucide: Rocket }} />,
      );
      // Lucide ships one inline <svg> per icon; ours adds a second for the
      // ring. So there are exactly 2 <svg> elements rendered.
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(2);
    });

    test('dot inner is transparent when progress < 1', () => {
      const { container } = render(
        <ProgressIcon progress={0.5} color="blue" inner={{ kind: 'dot' }} />,
      );
      const dot = container.querySelector('[data-completed]');
      expect(dot?.getAttribute('data-completed')).toBe('false');
      expect(dot?.className ?? '').toContain('bg-transparent');
    });

    test('dot inner fills with the project color when progress = 1', () => {
      const { container } = render(
        <ProgressIcon progress={1} color="purple" inner={{ kind: 'dot' }} />,
      );
      const dot = container.querySelector('[data-completed]');
      expect(dot?.getAttribute('data-completed')).toBe('true');
      expect(dot?.className ?? '').toContain('bg-purple');
    });
  });

  describe('color binding', () => {
    test('uses the color\'s text-{color} class on the filled arc', () => {
      const { container } = render(
        <ProgressIcon progress={0.5} color="red" inner={{ kind: 'dot' }} />,
      );
      const arc = getArc(container);
      expect(arc.getAttribute('class') ?? '').toContain('text-red');
    });

    test('switches arc to text-white when active = true', () => {
      const { container } = render(
        <ProgressIcon progress={0.5} color="red" inner={{ kind: 'dot' }} active />,
      );
      const arc = getArc(container);
      expect(arc.getAttribute('class') ?? '').toContain('text-white');
      expect(arc.getAttribute('class') ?? '').not.toContain('text-red');
    });
  });
});
