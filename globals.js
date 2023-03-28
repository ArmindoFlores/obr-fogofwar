const ID = "com.armindoflores.fogofwar";

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

export { ID };
export const sceneCache = new SceneCash();