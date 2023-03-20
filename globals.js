const ID = "com.armindoflores.fogofwar";

class SceneCash {
    constructor() {
        this.items = undefined; 
        this.metadata = undefined;
        this.gridDpi = undefined;
        this.gridScale = undefined;
    }
};

export { ID };
export const sceneCache = new SceneCash();