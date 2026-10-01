import { expect, test } from "@playwright/test";
import type { Book } from "../../lib/types";

const books: Book[] = Array.from({ length: 5 }, (_, index) => ({
  id: `fixture-${index}`,
  title: index === 0 ? "Harry Potter and the Order of the Phoenix" : `Example Book ${index}`,
  author: "J. K. Rowling", firstPublished: 2003, coverId: index + 1,
  color: "#305567", ink: "#fff", accent: "#dcc89e", material: "cloth",
  height: 250, width: 48, mark: "HP", isbn: null, openLibraryKey: null,
}));

const sizes = [
  [320, 568], [375, 812], [390, 844], [768, 1024],
  [844, 390], [1280, 600], [1440, 900], [1920, 1080],
] as const;

test.beforeEach(async ({ page }) => {
  await page.route("https://covers.openlibrary.org/**", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#305567"/></svg>',
  }));
  await page.route("**/api/search", (route) => route.fulfill({ json: { mode: "jev", results: books.map((book) => ({ book, probability: .9 })) } }));
});

for (const [width, height] of sizes) {
  test(`search, refine, metadata, clear at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Ask your bookshelf" });
    await expect(input).toBeVisible();
    await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
    await expect(page.locator(".dev-controls")).toHaveCount(0);
    await expect.poll(() => page.locator(".book-spine").count()).toBeGreaterThanOrEqual(144);
    expect(await page.locator(".book-spine").count()).toBeLessThanOrEqual(288);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    // Verify both tracks cover the viewport throughout their complete animation.
    await expect.poll(() => page.locator(".marquee-track").evaluateAll((tracks) => tracks.every((track) => {
      const sequence = track.firstElementChild as HTMLElement;
      const full = track.getBoundingClientRect().width;
      return sequence.offsetWidth >= innerWidth && Math.abs(full - sequence.offsetWidth * 2) < 2;
    }))).toBe(true);
    await input.fill("Harry Potter");
    await input.press("Enter");
    await expect(page.locator(".state-settled")).toBeVisible();
    await expect(page.locator(".book-result")).toHaveCount(5);
    await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(2.25px)");
    await page.locator(".book-result").first().focus();
    const metadata = page.locator(".book-result-metadata").first();
    await expect(metadata).toHaveCSS("opacity", "1");
    const caption = await metadata.boundingBox();
    const cover = await page.locator(".book-result").first().boundingBox();
    const carousel = await page.locator(".cover-row").boundingBox();
    const search = await input.boundingBox();
    expect(caption!.width).toBeLessThanOrEqual(cover!.width + 1);
    expect(caption!.y + caption!.height).toBeLessThanOrEqual(search!.y);
    if (width <= 720) expect(caption!.y + caption!.height).toBeLessThanOrEqual(carousel!.y + carousel!.height);
    expect(search!.y + search!.height).toBeLessThan(height);
    await info.attach("results", { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
    const previous = await page.locator(".search-cluster").boundingBox();
    await input.fill("Harry Potter author");
    await input.press("Enter");
    await expect(page.locator(".state-settled")).toBeVisible();
    expect(Math.abs((await page.locator(".search-cluster").boundingBox())!.y - previous!.y)).toBeLessThan(2);
    await page.getByRole("button", { name: "Clear search and results" }).click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".book-result")).toHaveCount(0);
    await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
    expect(errors).toEqual([]);
  });
}

test("clicked books return to the tray on mouse leave while keyboard focus still reveals details", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Ask your bookshelf" });
  await input.fill("Harry Potter");
  await input.press("Enter");
  await expect(page.locator(".state-settled")).toBeVisible();
  const book = page.locator(".book-result").nth(2);
  const metadata = book.locator(".book-result-metadata");
  await book.hover();
  await expect(book).toHaveAttribute("data-active", "true");
  await book.click();
  await page.mouse.move(10, 10);
  await expect(book).toHaveAttribute("data-active", "false");
  await expect(metadata).toHaveCSS("opacity", "0");
  await expect(book.locator(".book-cover-lift")).toHaveCSS("transform", "none");
  await expect(page.locator('.book-result[data-active="true"]')).toHaveCount(0);

  await input.focus();
  await input.press("Shift+Tab");
  const keyboardBook = page.locator(".book-result").last();
  await expect(keyboardBook).toBeFocused();
  await expect(keyboardBook).toHaveAttribute("data-active", "true");
  await expect(keyboardBook.locator(".book-result-metadata")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Tab");
  await expect(keyboardBook).toHaveAttribute("data-active", "false");
});

for (const [width, height] of [[320, 568], [768, 1024], [1440, 900]] as const) {
  test(`promoted UI theme stays consistent and usable at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/ui-agentic");
    const input = page.getByRole("textbox", { name: "Ask your bookshelf" });
    await expect(input).toHaveCSS("font-size", "16px");
    await expect(input).toHaveCSS("font-weight", "400");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await input.fill("Harry Potter");
    await expect(page.locator(".search-form")).toHaveCSS("border-top-color", "rgba(41, 41, 41, 0.55)");
    await expect(page.locator(".search-form")).toHaveCSS("box-shadow", "rgba(41, 41, 41, 0.035) 0px 2px 8px 0px");
    await input.press("Enter");
    await expect(page.locator(".state-settled")).toBeVisible();
    const book = page.locator(".book-result").first();
    await book.focus();
    const metadata = book.locator(".book-result-metadata");
    await expect(metadata).toHaveCSS("opacity", "1");
    await expect(metadata).toHaveCSS("font-size", "12px");
    const caption = await metadata.boundingBox();
    const cover = await book.boundingBox();
    const carousel = await page.locator(".cover-row").boundingBox();
    const search = await input.boundingBox();
    expect(caption!.width).toBeLessThanOrEqual(cover!.width + 1);
    expect(caption!.y + caption!.height).toBeLessThan(search!.y);
    if (width <= 720) expect(caption!.y + caption!.height).toBeLessThanOrEqual(carousel!.y + carousel!.height);
    await info.attach("ui-comparison", { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
    await page.getByRole("button", { name: "Clear search and results" }).click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".book-result")).toHaveCount(0);

    await page.route("**/api/search", (route) => route.fulfill({ json: { mode: "jev", results: [] } }));
    await input.fill("No match");
    await input.press("Enter");
    await expect(page.getByRole("status")).toHaveText("No matching books. Try another search.");
    await page.goto("/");
    await expect(page.getByRole("textbox")).toHaveCSS("font-size", "16px");
    await expect(page.getByRole("textbox")).toHaveCSS("font-weight", "400");
    await expect(page.locator(".search-form")).toHaveCSS("border-top-color", "rgba(41, 41, 41, 0.18)");
    expect(errors).toEqual([]);
  });
}

test("rate-limit feedback is visible without progress text", async ({ page }) => {
  await page.route("**/api/search", (route) => route.fulfill({ status: 429, headers: { "Retry-After": "42" }, json: { error: "Too many searches" } }));
  await page.goto("/");
  await page.getByRole("textbox").fill("books");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByRole("status")).toHaveText("Too many searches. Try again in 42 seconds.");
});

test("pressing the compact clear button does not move it before release", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Ask your bookshelf" });
  await input.fill("Harry Potter");
  await input.press("Enter");
  await expect(page.locator(".state-settled")).toBeVisible();
  const cluster = page.locator(".search-cluster");
  await expect(cluster).toHaveClass(/is-compact/);
  const clear = page.getByRole("button", { name: "Clear search and results" });
  await clear.focus();
  await expect(cluster).toHaveClass(/is-compact/);
  // Wait for the completed compact layout, then preserve real mouse coordinates.
  await expect.poll(async () => Math.round((await cluster.boundingBox())!.width)).toBe(420);
  const before = (await clear.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await expect(cluster).toHaveClass(/is-compact/);
  const pressed = (await clear.boundingBox())!;
  // The button's existing press-scale is allowed; its center must stay put.
  expect(Math.abs(pressed.x + pressed.width / 2 - before.x - before.width / 2)).toBeLessThan(1);
  await page.mouse.up();
  await expect(input).toHaveValue("");
  await expect(page.locator(".book-result")).toHaveCount(0);
  await expect(cluster).not.toHaveClass(/has-result-layout/);
  await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
});

test("resize and reduced-motion preserve the result layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("textbox").fill("books");
  await page.getByRole("textbox").press("Enter");
  await expect(page.locator(".state-settled")).toBeVisible();
  await expect(page.locator(".marquee-track").first()).toHaveCSS("animation-name", "none");
  for (const entrance of await page.locator(".page-entrance").all()) {
    await expect(entrance).toHaveCSS("animation-name", "none");
    await expect(entrance).toHaveCSS("transform", "none");
    await expect(entrance).toHaveCSS("opacity", "1");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".book-result").last().focus();
  await expect(page.locator(".book-result-metadata").last()).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole("textbox")).toBeInViewport();
  await page.getByRole("button", { name: "Clear search and results" }).click();
  await expect(page.locator(".book-result")).toHaveCount(0);
});

test("no-match responses remain clear and do not shift the input", async ({ page }) => {
  await page.route("**/api/search", (route) => route.fulfill({ json: { mode: "demo", results: [] } }));
  await page.goto("/");
  const input = page.getByRole("textbox");
  await expect.poll(() => page.locator(".search-entrance").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(0);
  const initial = await input.boundingBox();
  await input.fill("missing book");
  await input.press("Enter");
  await expect(page.getByRole("status")).toHaveText("No matching books. Try another search.");
  expect(Math.abs((await input.boundingBox())!.y - initial!.y)).toBeLessThan(2);
  await expect(page.locator(".shelves")).toHaveCSS("filter", "blur(0px)");
});

test("page entrance staggers from opposite edges and never replays during search", async ({ page }) => {
  // Freeze at the initial pose, independently of machine/load speed.
  await page.route("**/*.css", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n.page-entrance { animation-play-state: paused !important; }` });
  });
  await page.goto("/");
  const entrances = page.locator(".page-entrance");
  await expect(entrances).toHaveCount(3);
  await expect(page.locator(".experience")).toHaveClass(/is-entry-ready/);
  const poses = await entrances.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { delay: style.animationDelay, duration: style.animationDuration, filter: style.filter,
      y: new DOMMatrixReadOnly(style.transform).m42, opacity: style.opacity };
  }));
  expect(poses[0].delay).toBe("0s");
  expect(poses[0].y).toBeLessThan(0);
  expect(poses[1].delay).toBe("0.12s");
  expect(poses[1].y).toBeGreaterThan(0);
  expect(poses[2].delay).toBe("0.06s");
  expect(poses[2].y).toBeGreaterThan(0);
  expect(poses.map((pose) => pose.opacity)).toEqual(["0", "0", "0"]);
  expect(poses.map((pose) => pose.duration)).toEqual(["0.5s", "0.5s", "0.5s"]);
  expect(poses.map((pose) => Math.abs(pose.y))).toEqual([24, 24, 16]);
  expect(poses.map((pose) => pose.filter)).toEqual(["blur(4px)", "blur(4px)", "blur(4px)"]);

  // Focusing mid-flight must not snap the input into its final position.
  await page.getByRole("textbox").focus();
  expect(await page.locator(".search-entrance").evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(16);
  const midpoint = await entrances.evaluateAll((elements) => elements.map((element) => {
    const animation = element.getAnimations()[0];
    const timing = animation.effect!.getTiming();
    animation.currentTime = Number(timing.delay) + Number(timing.duration) / 2;
    const style = getComputedStyle(element);
    return { y: new DOMMatrixReadOnly(style.transform).m42, opacity: Number(style.opacity), filter: style.filter };
  }));
  midpoint.forEach((pose, index) => {
    expect(Math.abs(pose.y)).toBeLessThan(Math.abs(poses[index].y));
    expect(pose.opacity).toBeGreaterThan(0);
    expect(pose.opacity).toBeLessThan(1);
    expect(pose.filter).not.toBe("blur(4px)");
  });
  await entrances.evaluateAll((elements) => {
    elements.forEach((element) => element.getAnimations().forEach((animation) => animation.finish()));
  });
  await page.getByRole("textbox").fill("books");
  await page.getByRole("textbox").press("Enter");
  await expect(page.locator(".book-result")).toHaveCount(5);
  await page.getByRole("button", { name: "Clear search and results" }).click();
  await expect(page.locator(".book-result")).toHaveCount(0);
  for (const entrance of await entrances.all()) {
    expect(await entrance.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(0);
    await expect(entrance).toHaveCSS("filter", "none");
    await expect(entrance).toHaveCSS("opacity", "1");
  }
});

test("cold-load hydration sizes the marquee before starting motion", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route("**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".experience")).not.toHaveClass(/is-entry-ready/);
    await expect(page.locator(".marquee-track").first()).toHaveCSS("animation-play-state", "paused");
    await expect(page.locator(".shelf-entrance").first()).toHaveCSS("animation-play-state", "paused");
  } finally {
    releaseScripts();
  }
  await expect(page.locator(".experience")).toHaveClass(/is-entry-ready/);
  const before = await page.locator(".marquee-track").evaluateAll((tracks) => tracks.map((track) => ({
    width: (track.firstElementChild as HTMLElement).offsetWidth,
    duration: getComputedStyle(track).animationDuration,
  })));
  before.forEach((track) => expect(track.width).toBeGreaterThanOrEqual(1920));
  await expect(page.locator(".shelf-entrance").last()).toHaveClass(/is-entered/);
  const after = await page.locator(".marquee-track").evaluateAll((tracks) => tracks.map((track) => ({
    width: (track.firstElementChild as HTMLElement).offsetWidth,
    duration: getComputedStyle(track).animationDuration,
  })));
  expect(after).toEqual(before);
});

test("production API and security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const invalid = await request.post("/api/search", { data: { query: {} } });
  expect(invalid.status()).toBe(400);
  const crossSite = await request.post("/api/search", { data: { query: "books" }, headers: { Origin: "https://attacker.example" } });
  expect(crossSite.status()).toBe(403);
});
