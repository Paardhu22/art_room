import { atelier } from "./engine.js";
import { scenes } from "./catalog.js";
const params = new URLSearchParams(location.search),
  select = document.querySelector("#scene"),
  seedInput = document.querySelector("#seed"),
  canvas = document.querySelector("canvas"),
  status = document.querySelector("#status");
for (const scene of scenes) {
  const option = document.createElement("option");
  option.value = scene.id;
  option.textContent = scene.title;
  select.append(option);
}
select.value = scenes.some((s) => s.id === params.get("scene"))
  ? params.get("scene")
  : scenes[0].id;
seedInput.value =
  params.get("seed") || scenes.find((s) => s.id === select.value).seed;
let renderToken = 0;
export async function renderScene(id, seed) {
  const token = ++renderToken;
  window.artworkRendered = false;
  window.artworkError = null;
  const scene = scenes.find((s) => s.id === id);
  if (!scene) throw new Error("Unknown scene");
  status.textContent = `Drawing ${scene.title}…`;
  document.querySelector("#download").disabled = true;
  document.querySelector("#source").href = `scenes/${scene.id}.js`;
  try {
    const module = await import(`./scenes/${id}.js`);
    if (token !== renderToken) return;
    // Yield one frame so the loading label paints before the engraving pass.
    await new Promise(requestAnimationFrame);
    if (token !== renderToken) return;
    const started = performance.now();
    module.draw(atelier(canvas, seed));
    status.textContent = `${scene.title} · ${scene.location} · seed ${seed} · rendered in ${((performance.now() - started) / 1000).toFixed(2)} s`;
    document.title = `${scene.title} — JavaScript atelier`;
    window.artworkRendered = true;
    document.querySelector("#download").disabled = false;
    history.replaceState(
      null,
      "",
      `?scene=${encodeURIComponent(id)}&seed=${seed}`,
    );
  } catch (error) {
    window.artworkError = error.message;
    status.textContent = `The sketch could not render: ${error.message}`;
    console.error(error);
  }
}
function render() {
  const value = Number(seedInput.value);
  const seed =
    Number.isSafeInteger(value) && value > 0 && value <= 4294967295
      ? value
      : scenes.find((s) => s.id === select.value).seed;
  seedInput.value = seed;
  return renderScene(select.value, seed);
}
select.addEventListener("change", () => {
  seedInput.value = scenes.find((s) => s.id === select.value).seed;
  render();
});
document.querySelector("#render").addEventListener("click", render);
seedInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") render();
});
document.querySelector("#variation").addEventListener("click", () => {
  seedInput.value = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  render();
});
document.querySelector("#download").addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `${select.value}-${seedInput.value}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});
render();
