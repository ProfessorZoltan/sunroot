// Milestone 0: a blank page that proves the build renders. The map and HUD
// arrive in Milestones 3 and 4; they will only read simulation state and send
// commands to src/sim.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `<main><h1>Sunroot</h1><p>A settlement is taking root.</p></main>`;
}
