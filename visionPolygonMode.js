import OBR, { buildCurve } from "@owlbear-rodeo/sdk";
import { ID } from "./globals";

let interaction = null;
async function onToolDoubleClick(context, event) {
  if (!interaction) {
    // Build a line with the start and end position of our pointer
    const line = buildCurve()
    .tension(0)
    .points([event.pointerPosition, event.pointerPosition])
    .fillColor("#000000")
    .strokeColor("#000000")
    .layer("DRAWING")
    .build();
    // Start an interaction with the new line
    interaction = await OBR.interaction.startItemInteraction(line);
  }
  else {
    const [update, stop] = interaction;
    // Perform a final update when the drag ends
    // This gets us the final line item
    const polygon = update((polygon) => {
      polygon.points.push(event.pointerPosition);
      polygon.points.push(polygon.points[0]);
      polygon.visible = false;
      polygon.metadata[`${ID}/isVisionLine`] = true;
      polygon.layer = "FOG";
    });
    // Add the polygon to the scene
    OBR.scene.items.addItems([polygon]);
    // Make sure we stop the interaction so others
    // can interact with our new polygon
    stop();
    interaction = null;
  }
}

function onToolMove(_, event) {
  // Update the end position of the interaction when the tool drags
  if (interaction) {
    const [update] = interaction;
    update((line) => {
      line.points[line.points.length-1] = event.pointerPosition;
    });
  }
}

function onToolClick(_, event) {
  // Update the end position of the interaction when the tool drags
  if (interaction) {
    const [update] = interaction;
    update((line) => {
      line.points.push(event.pointerPosition);
    });
  }
}

export const polygonMode = {onToolClick, onToolDoubleClick, onToolMove};