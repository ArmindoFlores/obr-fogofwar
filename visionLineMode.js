import OBR, { buildCurve, buildLabel, buildShape } from "@owlbear-rodeo/sdk";
import { ID } from "./globals";

let interaction = null, finishLabelId = "", finishId = "", cancelId = "", cancelLabelId = "";

async function cleanUpPopovers() {
  OBR.scene.local.deleteItems([cancelLabelId, finishLabelId, finishId, cancelId]);
  finishLabelId = "";
  finishId = "";
  cancelLabelId = "";
  cancelId = "";
}

async function cancelDrawing() {
  if (!interaction)
    return;

  const [_, stop] = interaction;
  stop();
  interaction = null;
  cleanUpPopovers();
}

async function finishDrawing() {
  if (!interaction)
    return;

  const [update, stop] = interaction;
  // Add the line to the scene
  const line = update(line => {
    line.visible = false;
    line.metadata[`${ID}/isVisionLine`] = true;
    line.points.pop();
  });
  if (line.points.length >= 2)
    OBR.scene.items.addItems([line]);
  // Make sure we stop the interaction so others
  // can interact with our new line
  stop();
  interaction = null;
  cleanUpPopovers();
}

async function onToolClick(_, event) {
  if (event.transformer)
    return;
  if (!interaction) {
    const line = buildCurve()
      .tension(0)
      .points([event.pointerPosition, event.pointerPosition])
      .fillColor("#000000")
      .fillOpacity(0)
      .layer("DRAWING")
      .name("Vision Line (Line)")
      .closed(false)
      .build();
  
    interaction = await OBR.interaction.startItemInteraction(line);

    const finish = buildShape()
      .shapeType("CIRCLE")
      .strokeColor("#FFFFFF")
      .width(8)
      .height(8)
      .strokeWidth(2)
      .position(event.pointerPosition)
      .layer("POPOVER")
      .build();
    const finishLabel = buildLabel()
      .plainText("Finish")
      .position(event.pointerPosition)
      .layer("POPOVER")
      .build(); 

    const cancel = buildShape()
      .shapeType("CIRCLE")
      .strokeColor("#FFFFFF")
      .width(8)
      .height(8)
      .strokeWidth(2)
      .position(event.pointerPosition)
      .layer("POPOVER")
      .visible(false)
      .build();
    const cancelLabel = buildLabel()
      .plainText("Cancel")
      .position(event.pointerPosition)
      .layer("POPOVER")
      .build(); 
    
    OBR.scene.local.addItems([finishLabel, finish, cancel, cancelLabel]);
    finishLabelId = finishLabel.id;
    finishId = finish.id;
    cancelLabelId = cancelLabel.id;
    cancelId = cancel.id;
  }
  else {
    if (event.target && (event.target.id === finishLabelId || event.target.id === finishId))
      finishDrawing();
    else if (event.target && (event.target.id === cancelLabelId || event.target.id === cancelId))
      cancelDrawing();
    else {
      const [update] = interaction;
      update((line) => {
        line.points.push(event.pointerPosition);
      });

      OBR.scene.local.updateItems(item => item.id == finishId || item.id == finishLabelId, items => {
        for (const item of items) {
          item.position = event.pointerPosition;
        }
      });
    }
  }
}

function onToolMove(_, event) {
  if (!interaction || event.transformer)
    return;

  // Update the end position of the interaction when the tool moves
  const [update] = interaction;
  update((line) => {
    line.points[line.points.length-1] = event.pointerPosition;
  });
}

export const lineMode = {onToolClick, onToolMove};