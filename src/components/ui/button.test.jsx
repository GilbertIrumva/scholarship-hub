import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button.jsx';

describe('<Button />', () => {
    it('renders its children as text', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('fires onClick when the user clicks', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Go</Button>);
        await user.click(screen.getByRole('button', { name: /go/i }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('blocks clicks when disabled', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Button disabled onClick={onClick}>Nope</Button>);
        await user.click(screen.getByRole('button', { name: /nope/i }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('applies brand classes from the default variant', () => {
        render(<Button>Brand</Button>);
        const btn = screen.getByRole('button', { name: /brand/i });
        expect(btn.className).toMatch(/bg-primary/);
    });

    it('applies destructive variant when requested', () => {
        render(<Button variant="destructive">Delete</Button>);
        const btn = screen.getByRole('button', { name: /delete/i });
        expect(btn.className).toMatch(/bg-danger/);
    });
});
