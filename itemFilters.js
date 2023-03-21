import { ID } from "./globals";

function isBackgroundImage(item) { return item.layer == "MAP" && item.metadata[`${ID}/isBackgroundImage`]; }
function isVisionFog(item) { return item.metadata[`${ID}/isVisionFog`]; }
function isVisionLine(item) { return item.metadata[`${ID}/isVisionLine`]; }
function isActiveVisionLine(item) { return item.metadata[`${ID}/isVisionLine`] && !item.metadata[`${ID}/disabled`]; }

export {isBackgroundImage, isVisionFog, isVisionLine, isActiveVisionLine};