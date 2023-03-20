import { ID } from "./globals";

function isBackgroundImage(item) { return item.layer == "MAP" && item.metadata[`${ID}/isBackgroundImage`]; }
function isVisionFog(item) { return item.metadata[`${ID}/isVisionFog`]; }
function isVisionLine(item) { return item.metadata[`${ID}/isVisionLine`]; }

export {isBackgroundImage, isVisionFog, isVisionLine};