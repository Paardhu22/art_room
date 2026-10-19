import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { chromium } from "playwright";
import { scenes } from "../artwork/catalog.js";

const base = process.env.ART_ROOM_TEST_URL || "http://127.0.0.1:4300";
const scope = { window: {} };
vm.runInNewContext(await readFile("artworks.js", "utf8"), scope);
vm.runInNewContext(await readFile("artwork/collection.js", "utf8"), scope);
assert.equal(scenes.length, 9);
assert.equal(scope.window.ARTWORKS.length, 12);
assert.equal(new Set(scope.window.ARTWORKS.map((work) => work.id)).size, 12);
for (const scene of scenes) {
  assert.equal(
    typeof (await import(`../artwork/scenes/${scene.id}.js`)).draw,
    "function",
  );
  for (const size of [480, 800, 1200]) {
    const buffer = await readFile(`assets/artworks/${scene.id}-${size}.webp`);
    assert.equal(buffer.subarray(8, 12).toString(), "WEBP");
  }
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const scene of scenes) {
    await page.goto(
      `${base}/artwork/studio.html?scene=${scene.id}&seed=${scene.seed}`,
    );
    await page.waitForFunction(
      () => window.artworkRendered || window.artworkError,
      undefined,
      { timeout: 120000 },
    );
    assert.equal(await page.evaluate(() => window.artworkError), null);
    const fingerprint = async () =>
      createHash("sha256")
        .update(
          await page
            .locator("canvas")
            .evaluate((canvas) => canvas.toDataURL("image/png")),
        )
        .digest("hex");
    const original = await fingerprint();
    await page.evaluate(
      async ({ id, seed }) => {
        const { renderScene } = await import("./studio.js");
        await renderScene(id, seed);
      },
      { id: scene.id, seed: scene.seed },
    );
    assert.equal(
      await fingerprint(),
      original,
      `${scene.id}: identical seeds reproduce identical artwork`,
    );
    await page.evaluate(
      async ({ id, seed }) => {
        const { renderScene } = await import("./studio.js");
        await renderScene(id, seed + 1);
      },
      { id: scene.id, seed: scene.seed },
    );
    assert.notEqual(
      await fingerprint(),
      original,
      `${scene.id}: a different seed produces a variation`,
    );
    assert.equal(
      await page
        .locator("canvas")
        .evaluate((canvas) => canvas.width === 1200 && canvas.height === 1200),
      true,
    );
    console.log(
      `${scene.id}: source renders, deterministic replay and seeded variation passed.`,
    );
  }
  await page.goto(base);
  assert.equal(await page.locator(".art-card").count(), 12);
  assert.equal(
    await page.locator("canvas").count(),
    0,
    "Gallery uses exported images, not expensive render loops",
  );
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/art-room-locations-${width}.png`,
      fullPage: width === 1440,
    });
  }
  await page.getByRole("searchbox").fill("Japan");
  assert.equal(await page.locator(".art-card").count(), 1);
  await page
    .getByRole("link", { name: "View The pagoda after the rain", exact: true })
    .click();
  await page.locator("#viewer-image").evaluate((image) => image.decode());
  assert.ok(
    (await page.locator("#viewer-sketch").getAttribute("href")).includes(
      "scene=pagoda",
    ),
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.equal(
    await page.locator("#viewer-zoom").getAttribute("aria-pressed"),
    "true",
  );
  await page.keyboard.press("Escape");
  assert.ok(
    !(await page
      .locator("body")
      .evaluate((body) => body.classList.contains("viewer-open"))),
  );
  assert.equal(
    await page
      .locator(".art-image-link")
      .evaluate((el) => document.activeElement === el),
    true,
  );
  await page.getByRole("searchbox").fill("not-a-real-work");
  await page.getByRole("button", { name: "Show all works" }).click();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  assert.equal(await page.locator(".art-card").count(), 10);
  await page
    .getByRole("link", { name: "View The pagoda after the rain", exact: true })
    .click();
  for (const work of scope.window.ARTWORKS.filter(
    (work) => work.category === "places",
  )) {
    assert.equal(await page.locator("#viewer-title").textContent(), work.title);
    await page.locator("#viewer-image").evaluate((image) => image.decode());
    await page
      .getByRole("button", { name: "Next artwork", exact: true })
      .click();
  }
  assert.equal(
    await page.locator("#viewer-title").textContent(),
    scenes[0].title,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "List view", exact: true }).click();
  assert.equal(await page.locator(".is-list .art-card").count(), 10);
  await page.getByRole("button", { name: "Botanical", exact: true }).click();
  await page
    .getByRole("link", { name: "View Ananas comosus", exact: true })
    .click();
  assert.equal(
    await page.locator("#viewer-sketch").isVisible(),
    false,
    "Original pieces retain their existing viewer",
  );
  await page.keyboard.press("Escape");
  await page.goto(`${base}/artwork/studio.html?scene=pagoda`);
  await page.waitForFunction(() => window.artworkRendered);
  await page.setViewportSize({ width: 375, height: 900 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  assert.ok((await downloadPromise).suggestedFilename().startsWith("pagoda-"));
  await page.screenshot({
    path: "/tmp/art-room-live-sketch-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "12-work gallery, all 9 live sketches, responsive layouts, filtering, zoom, viewer navigation, original pieces and PNG download passed.",
  );
} finally {
  await browser.close();
}
