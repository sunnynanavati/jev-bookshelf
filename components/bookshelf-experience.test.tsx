import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookshelfExperience } from "@/components/bookshelf-experience";
import { bookById } from "@/data/books";

const emptyShelves = { top: [], bottom: [] };
const resultFor = (id: string) => ({ book: bookById.get(id), probability: null });

vi.mock("@/lib/covers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/covers")>();
  return { ...actual, preloadBookCovers: vi.fn().mockResolvedValue(undefined) };
});

describe("BookshelfExperience", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hides development controls until the shortcut toggles them", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<BookshelfExperience shelfRows={emptyShelves} />);
    expect(screen.queryByLabelText("Shelf blur strength")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "B", ctrlKey: true, shiftKey: true });
    expect(screen.getByLabelText("Shelf blur strength")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "B", ctrlKey: true, shiftKey: true, repeat: true });
    expect(screen.getByLabelText("Shelf blur strength")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "B", ctrlKey: true, shiftKey: true });
    expect(screen.queryByLabelText("Shelf blur strength")).not.toBeInTheDocument();
  });

  it("never exposes development controls or saved blur overrides in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    window.localStorage.setItem("jev-shelf-blur", "6");
    const { container } = render(<BookshelfExperience shelfRows={emptyShelves} />);
    fireEvent.keyDown(window, { key: "B", ctrlKey: true, shiftKey: true });
    expect(screen.queryByLabelText("Shelf blur strength")).not.toBeInTheDocument();
    expect(container.querySelector("main")?.style.getPropertyValue("--shelf-blur")).toBe("0px");
  });

  it("starts the search-icon motion with the first character and stops when editing ends", async () => {
    const user = userEvent.setup();
    const { container } = render(<BookshelfExperience shelfRows={emptyShelves} />);
    const input = screen.getByLabelText("Ask your bookshelf");
    const icon = container.querySelector(".search-leading-icon");
    await user.click(input);
    expect(icon).not.toHaveClass("is-scanning");
    await user.type(input, "h");
    expect(icon).toHaveClass("is-scanning");
    await user.clear(input);
    expect(icon).not.toHaveClass("is-scanning");
    await user.type(input, "h");
    fireEvent.blur(input);
    expect(icon).not.toHaveClass("is-scanning");
  });

  it("uses zero idle blur in production, blurs results, and restores zero on clear", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: "demo", results: [resultFor("nineteen-eighty-four")] }),
    }));
    const user = userEvent.setup();
    const { container } = render(<BookshelfExperience shelfRows={emptyShelves} />);
    const blur = () => container.querySelector("main")?.style.getPropertyValue("--shelf-blur");
    expect(blur()).toBe("0px");
    await user.type(screen.getByLabelText("Ask your bookshelf"), "Dystopian surveillance");
    await user.click(screen.getByRole("button", { name: "Search books" }));
    await screen.findByRole("heading", { name: "Nineteen Eighty-Four" });
    expect(blur()).toBe("2.25px");
    await user.click(screen.getByRole("button", { name: "Clear search and results" }));
    expect(blur()).toBe("0px");
  });

  it("shows an empty-result message without suggested searches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: "demo", results: [] }),
    }));
    const user = userEvent.setup();
    render(<BookshelfExperience shelfRows={emptyShelves} />);

    await user.type(screen.getByLabelText("Ask your bookshelf"), "cookbooks about pasta");
    await user.click(screen.getByRole("button", { name: "Search books" }));

    await waitFor(() => {
      expect(screen.getByText("No matching books. Try another search.")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("clears a settled search and restores the idle controls", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "demo",
        results: [resultFor("nineteen-eighty-four")],
      }),
    }));
    const user = userEvent.setup();
    const { container } = render(<BookshelfExperience shelfRows={emptyShelves} />);
    fireEvent.keyDown(window, { key: "B", ctrlKey: true, shiftKey: true });
    const blurSlider = screen.getByLabelText("Shelf blur strength");
    fireEvent.change(blurSlider, { target: { value: "1" } });
    expect(container.querySelector("main")?.style.getPropertyValue("--shelf-blur")).toBe("1px");

    const input = screen.getByLabelText("Ask your bookshelf");
    await user.type(input, "Dystopian surveillance");
    await user.click(screen.getByRole("button", { name: "Search books" }));

    await screen.findByRole("heading", { name: "Nineteen Eighty-Four" });
    const searchCluster = container.querySelector(".search-cluster");
    expect(searchCluster).toHaveClass("is-compact");
    await user.click(input);
    expect(searchCluster).not.toHaveClass("is-compact");
    fireEvent.blur(input);
    expect(searchCluster).toHaveClass("is-compact");
    expect(container.querySelector("main")?.style.getPropertyValue("--shelf-blur")).toBe("2.25px");
    expect(blurSlider).toBeDisabled();
    const clearButton = screen.getByRole("button", {
      name: "Clear search and results",
    });
    await user.click(clearButton);

    expect(input).toHaveValue("");
    expect(searchCluster).not.toHaveClass("is-compact");
    expect(container.querySelector("main")?.style.getPropertyValue("--shelf-blur")).toBe("1px");
    expect(blurSlider).not.toBeDisabled();
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Nineteen Eighty-Four" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Search books" })).toBeDisabled();
    expect(screen.queryByRole("button", {
      name: "Harry Potter books featuring Severus Snape",
    })).not.toBeInTheDocument();
  });

  it("keeps the search bar in its result position while refining a search", async () => {
    let resolveRefinedSearch: ((value: unknown) => void) | undefined;
    const refinedSearch = new Promise((resolve) => {
      resolveRefinedSearch = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mode: "demo",
          results: [resultFor("philosophers-stone")],
        }),
      })
      .mockReturnValueOnce(refinedSearch);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { container } = render(<BookshelfExperience shelfRows={emptyShelves} />);

    const input = screen.getByLabelText("Ask your bookshelf");
    await user.type(input, "harry");
    await user.click(screen.getByRole("button", { name: "Search books" }));
    await screen.findByRole("heading", { name: "Harry Potter and the Philosopher's Stone" });

    const searchCluster = container.querySelector(".search-cluster");
    expect(searchCluster).toHaveClass("has-result-layout");

    await user.type(input, " potter{enter}");
    expect(searchCluster).toHaveClass("has-result-layout");
    expect(screen.getByRole("heading", {
      name: "Harry Potter and the Philosopher's Stone",
    })).toBeInTheDocument();

    resolveRefinedSearch?.({
      ok: true,
      json: async () => ({
        mode: "demo",
        results: [resultFor("chamber-secrets")],
      }),
    });

    await screen.findByRole("heading", { name: "Harry Potter and the Chamber of Secrets" });
    expect(searchCluster).toHaveClass("has-result-layout");
  });
});
