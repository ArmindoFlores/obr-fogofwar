const ID = "com.armindoflores.fogofwar";
const DEFAULT_VISION_RADIUS = 30

class SceneCash {
    constructor() {
        this.items = undefined; 
        this.metadata = undefined;
        this.gridDpi = undefined;
        this.gridScale = undefined;
        this.fog = undefined;
        this.ready = false;
    }
};

export { ID, DEFAULT_VISION_RADIUS };
export const sceneCache = new SceneCash();