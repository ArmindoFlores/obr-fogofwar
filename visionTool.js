import OBR, { buildPath } from "@owlbear-rodeo/sdk";
import PathKitInit from "pathkit-wasm/bin/pathkit";
import wasm from "pathkit-wasm/bin/pathkit.wasm?url";
import { ID, sceneCache } from "./globals";
import { isBackgroundImage, isVisionFog, isVisionLine } from "./itemFilters";
import { polygonMode } from "./visionPolygonMode";
import { lineMode } from "./visionLineMode";
import { squareDistance, comparePosition } from "./mathutils";
import { Timer } from "./debug";
import { ObjectCache } from "./cache";

export function setupContextMenus() {
  // This context menu appears on character tokens and determines whether they
  // to render their FoW or not
  OBR.contextMenu.create({
    id: `${ID}/toggle-vision-menu`,
    icons: [
      {
        icon: "/resources/no-vision.svg",
        label: "Enable Vision",
        filter: {
          every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", `${ID}/hasVision`], value: undefined}],
        },
      },
      {
        icon: "/resources/icon.svg", // should use another image (like an 'X' overlapped with the base item)
        label: "Disable Vision",
        filter: {
          every: [{ key: "layer", value: "CHARACTER" }],
        },
      },
    ],
    async onClick(ctx) {
      OBR.scene.items.updateItems(ctx.items, items => {
        for (const item of items) {
          if (item.metadata[`${ID}/hasVision`] && item.layer == "CHARACTER") {
            delete item.metadata[`${ID}/hasVision`];
          }
          else if (item.layer == "CHARACTER"){
            item.metadata[`${ID}/hasVision`] = true;
          }
        }
      })
    },
  });

  // This context menu appears on images on the MAP layer and is used to set
  // which image is the background image. It is used to compute how far the
  // shadows need to be rendered, among other things
  OBR.contextMenu.create({
    id: `${ID}/set-background-image`,
    icons: [
      {
        icon: "/resources/set-background.svg",
        label: "Set as background image",
        filter: {
          every: [{ key: "layer", value: "MAP" }, { key: ["metadata", `${ID}/isBackgroundImage`], value: undefined}],
        },
      }
    ],
    onClick(ctx) {
      if (ctx.items.length != 1)
        return;
      const item = ctx.items[0];
      OBR.scene.items.updateItems(() => true, items => {
        for (const other_item of items) {
          if (item.id != other_item.id && other_item.metadata[`${ID}/isBackgroundImage`])
            delete other_item.metadata[`${ID}/isBackgroundImage`];
          else
            other_item.metadata[`${ID}/isBackgroundImage`] = true;
        }
      });
    }
  });
}

export function createTool() {
  // This is the tool the extension offers to draw vision liens
  OBR.tool.create({
    id: `${ID}/vision-tool`,
    icons: [
      {
        icon: "/resources/icon.svg",
        label: "Setup Vision",
      },
    ],
    onClick() { OBR.tool.activateTool(`${ID}/vision-tool`); },
  });
}

// This tool doesn't do what the name implies and will be removed
export function createMode() {
    // Create "erase" mode
    // OBR.tool.createMode({
    //   id: `${ID}/erase-vision-mode`,
    //   icons: [
    //     {
    //       icon: "/resources/add.svg", // mismatched item
    //       label: "Erase Vision",
    //       filter: {
    //         activeTools: [`${ID}/vision-tool`],
    //       },
    //     },
    //   ],
    //   async onClick() { 
    //     console.log(await OBR.scene.items.getItems());
    //    },
    // });
  
    // Create "add polygon" mode
    OBR.tool.createMode({
      id: `${ID}/add-vision-polygon-mode`,
      icons: [
        {
          icon: "/resources/object.svg",
          label: "Add Obstruction Object",
          filter: {
            activeTools: [`${ID}/vision-tool`],
          },
        },
      ],
      onToolClick: polygonMode.onToolClick,
      onToolMove: polygonMode.onToolMove,
    });

    // Create "add line" mode
    OBR.tool.createMode({
      id: `${ID}/add-vision-line-mode`,
      icons: [
        {
          icon: "/resources/line.svg",
          label: "Add Obstruction Line",
          filter: {
            activeTools: [`${ID}/vision-tool`],
          },
        },
      ],
      onToolClick: lineMode.onToolClick,
      onToolMove: lineMode.onToolMove,
    });
}

export function createActions() {
}

// This function is responsible for updating the performance information in the
// main extension iframe
function updatePerformanceInformation(performanceInfo) {
  for (const [key, value] of Object.entries(performanceInfo)) {
    const element = document.getElementById(key);
    element.innerText = value;
  }
}

var PathKit;
var busy = false;
// Generally, only one player will move at one time, so let's cache the
// computed shadows for all players and only update if something has 
// changed
const playerShadowCache = new ObjectCache(false);
// This is the function responsible for computing the shadows and the FoW
async function computeShadow(event) {
  busy = true;
  if (!PathKit) {
    // Is this allowed?
    PathKit = await PathKitInit({ locateFile: () => wasm });
  }
  if (!(await OBR.scene.isReady())) {
    // If we change scenes we should invalidate the cache
    playerShadowCache.invalidate((_, value) => value.shadowPath.delete());
    busy = false;
    return;
  }
  
  // Load information from the event
  const {
    awaitTimer, 
    computeTimer, 
    allItems, 
    metadata, 
    size, 
    offset,
    scale,
    visionShapes, 
    playersWithVision, 
    invalidateCache, 
    visionRange,
  } = event.detail;
  const [width, height] = size;

  let cacheHits = 0, cacheMisses = 0;
  if (invalidateCache)  // Something significant changed => invalidate cache
    playerShadowCache.invalidate((_, value) => value.shadowPath.delete());
  
  computeTimer.resume();
  
  const shouldComputeVision = metadata[`${ID}/visionEnabled`] === true;
  if (!shouldComputeVision) {
    // Clear fog
    await OBR.scene.items.deleteItems(allItems.filter(isVisionFog).map(fogItem => fogItem.id));
    busy = false;
    return;
  }
  
  // Extract all lines from the drawn shapes
  const visionLines = [];
  for (const shape of visionShapes) {
    for (let i = 0; i < shape.points.length-1; i++) {
      visionLines.push({
        startPosition: {x: (shape.points[i].x * shape.scale.x + shape.position.x), y: (shape.points[i].y * shape.scale.y + shape.position.y)},
        endPosition: {x: (shape.points[i+1].x * shape.scale.x + shape.position.x), y: (shape.points[i+1].y * shape.scale.y + shape.position.y)},
        originalShape: shape,
      });
    }
  }

  // `polygons` is a an array of arrays. Each element in the main array is
  // another array containing the individual shadows cast by a vision line
  // from the point of view of one player.
  const polygons = [];
  for (const player of playersWithVision) {
    const cacheResult = playerShadowCache.getValue(player.id);
    polygons.push([]);
    if (cacheResult !== undefined && comparePosition(cacheResult.player.position, player.position)) {
      continue; // The result is cached and will be used later, no need to do work
    }
    for (const line of visionLines) {
      // *1st step* - compute the points in the polygon representing the shadow
      // cast by `line` from the point of view of `player`.
      const v1 = {x: line.startPosition.x - player.position.x, y: line.startPosition.y - player.position.y};
      const v2 = {x: line.endPosition.x - player.position.x, y: line.endPosition.y - player.position.y};

      var proj1 = {x: 0, y: 0}, proj2 = {x: 0, y: 0};
      var xlim1 = 0, ylim1 = 0, xlim2 = 0, ylim2 = 0;

      // Make sure we don't go past the image borders
      //! This is probably not required if we later compute the intersection
      //! (using PathKit) of these polygons with a base rectangle the size of
      //! our background image
      if (v1.x < 0) xlim1 = offset[0] * scale[0];
      else xlim1 = (width + offset[0]) * scale[0];
      if (v1.y < 0) ylim1 = offset[1] * scale[1];
      else ylim1 = (height + offset[1]) * scale[1];
      if (v2.x < 0) xlim2 = offset[0] * scale[0];
      else xlim2 = (width + offset[0]) * scale[0];
      if (v2.y < 0) ylim2 = offset[1] * scale[1];
      else ylim2 = (height + offset[1]) * scale[1];
      
      const options1 = [], options2 = [];
      if (v1.x != 0) {
        const m = v1.y / v1.x;
        const b = line.startPosition.y - m * line.startPosition.x;
        options1.push({x: xlim1, y: m * xlim1 + b});
      }
      if (v1.y != 0) {
        const n = v1.x / v1.y;
        const c = n * line.startPosition.y - line.startPosition.x;
        options1.push({x: n * ylim1 - c, y: ylim1});
      }
      if (v2.x != 0) {
        const m = v2.y / v2.x;
        const b = line.endPosition.y - m * line.endPosition.x;
        options2.push({x: xlim2, y: m * xlim2 + b});
      }
      if (v2.y != 0) {
        const n = v2.x / v2.y;
        const c = n * line.endPosition.y - line.endPosition.x;
        options2.push({x: n * ylim2 - c, y: ylim2});
      }
      
      if (options1.length == 1 || squareDistance(options1[0], line.startPosition) < squareDistance(options1[1], line.startPosition))
        proj1 = options1[0];
      else
        proj1 = options1[1];
      
      if (options2.length == 1 || squareDistance(options2[0], line.endPosition) < squareDistance(options2[1], line.endPosition))
        proj2 = options2[0];
      else
        proj2 = options2[1];
      
      polygons[polygons.length-1].push({pointset: [
        {x: line.startPosition.x, y: line.startPosition.y},
        proj1,
        {x: xlim1, y: ylim1},
        {x: xlim2, y: ylim2},
        proj2,
        {x: line.endPosition.x, y: line.endPosition.y},
      ], fromShape: line.originalShape});
    }
  }
  if (polygons.length == 0) {
    busy = false;
    return;
  }

  // *2nd step* - compute shadow polygons for each player, merging all polygons
  // created previously (this can probably be merged into the last step)
  const itemsPerPlayer = {};
  for (let j = 0; j < polygons.length; j++) {
    const player = playersWithVision[j];
    let cacheResult = playerShadowCache.getValue(player.id);
    if (cacheResult !== undefined && comparePosition(cacheResult.player.position, player.position)) {
      // The value is cached, use it
      itemsPerPlayer[j] = cacheResult.shadowPath;
      cacheHits++;
      continue;
    }
    cacheMisses++;
    const playerPolygons = polygons[j];
    const path = PathKit.NewPath();

    // Merge all polygons
    for (const polygon of playerPolygons) {
      const shape = polygon.fromShape;
      const newPath = PathKit.NewPath();

      newPath.moveTo(polygon.pointset[0].x, polygon.pointset[0].y);
      for (let j = 1; j < polygon.pointset.length; j++) {
        newPath.lineTo(polygon.pointset[j].x, polygon.pointset[j].y);
      }
      newPath.close();

      if (shape.style.closed != false) {
        const shapePath = PathKit.NewPath();
        shapePath.moveTo(shape.points[0].x * shape.scale.x + shape.position.x, shape.points[0].y * shape.scale.y + shape.position.y);
        for (let i = 1; i < shape.points.length-1; i++)
          shapePath.lineTo(shape.points[i].x * shape.scale.x + shape.position.x, shape.points[i].y * shape.scale.y + shape.position.y);
        newPath.op(shapePath, PathKit.PathOp.DIFFERENCE);
        shapePath.delete();
      }
      path.op(newPath, PathKit.PathOp.UNION);
      newPath.delete();
    }
    if (path !== undefined) {
      path.simplify();
      itemsPerPlayer[j] = path;
      let cacheResult = playerShadowCache.getValue(player.id);
      if (cacheResult !== undefined) {
        cacheResult.shadowPath.delete();
      }
      // Cache the computed path for future use
      playerShadowCache.cacheValue(player.id, {shadowPath: path, player: player});
    }
  }

  // *3rd step* - create a shadow mask to merge all players' FoW
  let pathMask = undefined;
  for (const playerPath of Object.values(itemsPerPlayer)) {
    if (pathMask === undefined)
      pathMask = playerPath.copy();
    else
      pathMask.op(playerPath, PathKit.PathOp.INTERSECT);
  }
  pathMask.simplify()
  const itemsToAdd = [{cmds: pathMask.toCmds(), visible: true, zIndex: 3}];
  pathMask.delete();

  if (visionRange) {
    // Create vision circles that cut a fog rectangle in a lower layer
    const backgroundFog = PathKit.NewPath().rect(offset[0], offset[1], size[0], size[1]);
    const playerVision = PathKit.NewPath();
    for (const player of playersWithVision) {
        const ellipse = PathKit.NewPath().ellipse(player.position.x, player.position.y, visionRange, visionRange, 0, 0, 2*Math.PI);
        ellipse.op(playerShadowCache.getValue(player.id).shadowPath, PathKit.PathOp.DIFFERENCE);
        playerVision.op(ellipse, PathKit.PathOp.UNION);
        ellipse.delete();
      }
    playerVision.simplify();
    itemsToAdd.push({cmds: backgroundFog.toCmds(), visible: true, zIndex: 1}, {cmds: playerVision.toCmds(), visible: false, zIndex: 1})
  }

  computeTimer.pause(); awaitTimer.resume();

  // Update all items
  await Promise.all([
    OBR.scene.items.updateItems(isVisionLine, items => {
      for (const item of items)
        item.zIndex = 2;
    }),
    OBR.scene.items.addItems(itemsToAdd.map(item => {
      const path = buildPath().commands(item.cmds).locked(true).visible(item.visible).fillColor("#000000").strokeColor("#000000").layer("FOG").name("Fog of War").metadata({[`${ID}/isVisionFog`]: true}).build();
      path.zIndex = item.zIndex;
      return path;
    })),
    OBR.scene.items.deleteItems(allItems.filter(isVisionFog).map(fogItem => fogItem.id)),
  ]);
  
  const [awaitTimerResult, computeTimerResult] = [awaitTimer.stop(), computeTimer.stop()];
  updatePerformanceInformation({
    "compute_time": `${computeTimerResult} ms`, 
    "communication_time": `${awaitTimerResult} ms`, 
    "cache_hits": cacheHits,
    "cache_misses": cacheMisses,
  });

  busy = false;
}
document.addEventListener("updateVision", computeShadow)

var previousVisionShapes, previousPlayersWithVision, previousSize, previousVisionRange;
export async function onSceneDataChange() {
  if (busy)
    return;

  if (!(await OBR.scene.isReady()))
    return;

  const [awaitTimer, computeTimer] = [new Timer(), new Timer()];
  
  awaitTimer.start(); awaitTimer.pause();
  computeTimer.start();

  const playersWithVision = sceneCache.items.filter(item => item.metadata[`${ID}/hasVision`]);
  const visionShapes = sceneCache.items.filter(isVisionLine);
  const backgroundImage = sceneCache.items.filter(isBackgroundImage)?.[0];
  if (backgroundImage === undefined)
    return;

  const dpiRatio = sceneCache.gridDpi / backgroundImage.grid.dpi;
  const size = [backgroundImage.image.width * dpiRatio, backgroundImage.image.height * dpiRatio];
  const scale = [backgroundImage.scale.x, backgroundImage.scale.y];
  const offset = [backgroundImage.position.x, backgroundImage.position.y];
  document.getElementById("vision_size").innerText = `${size[0]}x${Math.round(size[1])} px`;

  const visionRange = sceneCache.metadata[`${ID}/playerVisionRange`];

  // Check if any values have changed and a re-draw is necessary
  const sVisionShapes = JSON.stringify(visionShapes);
  const sPlayersWithVision = JSON.stringify(playersWithVision);
  if (previousVisionShapes == sVisionShapes && previousPlayersWithVision == sPlayersWithVision && size[0] == previousSize[0] && size[1] == previousSize[1] && previousVisionRange == visionRange)
    return;

  // Check if the cache needs to be invalidated
  let invalidateCache = false;
  if (previousVisionShapes != sVisionShapes || size[0] != previousSize[0] || size[1] != previousSize[1])
    invalidateCache = true;

  previousPlayersWithVision = sPlayersWithVision;
  previousVisionShapes = sVisionShapes;
  previousSize = size;
  previousVisionRange = visionRange;
  computeTimer.pause();

  // Fire an `updateVisionEvent` to launch the `computeShadow` function.
  const updateVisionEvent = new CustomEvent("updateVision", {
    detail: {
      awaitTimer: awaitTimer,
      computeTimer: computeTimer,
      allItems: sceneCache.items,
      metadata: sceneCache.metadata,
      size: size,
      offset: offset,
      scale: scale,
      playersWithVision: playersWithVision,
      visionShapes: visionShapes,
      invalidateCache: invalidateCache,
      visionRange: visionRange ? sceneCache.gridDpi * (visionRange / sceneCache.gridScale + .5) : 0,
    }
  });

  if (!busy) {
    document.dispatchEvent(updateVisionEvent);
  }
}