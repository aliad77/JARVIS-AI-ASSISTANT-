import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathText, splitMath, toBlocks, toSpeech } from "../components/MathText";

describe("MathText", () => {
  it("renders inline and display math with KaTeX (with MathML for screen readers)", () => {
    const { container } = render(<MathText content={"The answer is $x = 5$.\n\n$$3x + 7 = 22$$"} />);
    expect(container.querySelectorAll(".katex").length).toBe(2);
    expect(container.querySelector("math")).not.toBeNull();
  });

  it("renders basic markdown as elements", () => {
    const { container } = render(<MathText content={"**Bold** idea\n\n1. first\n2. second\n\n- dot"} />);
    expect(container.querySelector("strong")?.textContent).toBe("Bold");
    expect(container.querySelectorAll("ol li").length).toBe(2);
    expect(container.querySelectorAll("ul li").length).toBe(1);
  });

  it("never injects HTML from message text", () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script><a href="https://evil.example">click</a>';
    const { container } = render(<MathText content={evil} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText(/onerror/)).toBeInTheDocument();
  });

  it("does not linkify URLs or allow KaTeX \\href", () => {
    const { container } = render(<MathText content={"Visit https://example.com and $\\href{javascript:alert(1)}{x}$"} />);
    expect(container.querySelector("a")).toBeNull();
    // KaTeX (trust: false) shows \\href as inert error text; the source only survives as a MathML annotation text node.
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.querySelector(".katex-html")?.textContent).toContain("\\href");
  });

  it("survives invalid LaTeX without throwing", () => {
    const { container } = render(<MathText content={"$\\frac{1}{$ and $$\\badcommand{x}$$"} />);
    expect(container.textContent).toBeTruthy();
  });

  it("keeps step numbers when display math splits a numbered list", () => {
    const { container } = render(<MathText content={"1. First\n\n$$x=1$$\n\n2. Second"} />);
    const lists = container.querySelectorAll("ol");
    expect(lists.length).toBe(2);
    expect(lists[1].getAttribute("start")).toBe("2");
  });

  it("splits math segments", () => {
    expect(splitMath("a $b$ c $$d$$").map((s) => s.kind)).toEqual(["text", "math", "text", "math"]);
    expect(toBlocks("para\n\n$$x$$").map((b) => b.type)).toEqual(["p", "math"]);
  });

  it("turns math into speakable words", () => {
    expect(toSpeech("**So** $x^2 = \\frac{1}{2}$")).toBe("So x squared equals 1 over 2");
  });
});
