import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge.jsx";
import { Alert, AlertTitle, AlertDescription } from "./alert.jsx";
import { Skeleton, SkeletonText, SkeletonCard } from "./skeleton.jsx";
import { EmptyState } from "./empty-state.jsx";

describe("<Badge />", () => {
  it("renders children", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText(/new/i)).toBeInTheDocument();
  });

  it("applies variant + size classes", () => {
    render(<Badge variant="success" size="lg">Verified</Badge>);
    const el = screen.getByText(/verified/i);
    expect(el.className).toMatch(/bg-emerald-100/);
    expect(el.className).toMatch(/text-sm/);
  });
});

describe("<Alert />", () => {
  it("renders with role=alert, title, and description", () => {
    render(
      <Alert variant="success">
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>Your changes are live.</AlertDescription>
      </Alert>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
    expect(screen.getByText(/your changes are live/i)).toBeInTheDocument();
  });
});

describe("<Skeleton />", () => {
  it("renders a hidden pulse placeholder", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const node = container.firstChild;
    expect(node).toHaveAttribute("aria-hidden", "true");
    expect(node.className).toMatch(/animate-pulse/);
  });

  it("SkeletonText renders requested number of lines", () => {
    const { container } = render(<SkeletonText lines={5} />);
    // 5 child skeleton divs inside the wrapper
    expect(container.firstChild.childNodes.length).toBe(5);
  });

  it("SkeletonCard renders without crashing", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("<EmptyState />", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Try again later."
        action={<button>Retry</button>}
      />
    );
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument();
    expect(screen.getByText(/try again later/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
