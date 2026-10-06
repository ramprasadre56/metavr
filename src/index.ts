import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { FocusDeskSystem } from './focus-desk.js';
import { PanelSystem } from './panel.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(PanelSystem);
  world.registerSystem(FocusDeskSystem);
});
