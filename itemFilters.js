import { ID } from "./globals";

function isBackgroundImage(item) { return item.layer == "MAP" && item.metadata[`${ID}/isBackgroundImage`]; }
function isVisionFog(item) { return item.metadata[`${ID}/isVisionFog`]; }
function isVisionLine(item) { return item.metadata[`${ID}/isVisionLine`]; }
function isActiveVisionLine(item) { return item.metadata[`${ID}/isVisionLine`] && !item.metadata[`${ID}/disabled`]; }
function isPlayerWithVision(item) { return item.layer == "CHARACTER" && item.metadata[`${ID}/hasVision`]; }

export {isBackgroundImage, isVisionFog, isVisionLine, isActiveVisionLine, isPlayerWithVision};