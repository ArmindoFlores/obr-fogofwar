export class Timer {
    constructor() {
        this.startTime = -1;
        this.accumulatedTime = -1;
    }

    start() {
        this.startTime = performance.now();
        this.accumulatedTime = 0;
    }

    resume() {
        this.startTime = performance.now();
    }

    pause() {
        this.accumulatedTime += performance.now() - this.startTime;
        this.startTime = -1;
        return this.accumulatedTime;
    }

    stop() {
        if (this.startTime != -1) {
            const result = performance.now() - this.startTime + this.accumulatedTime;
            this.accumulatedTime = 0;
            return result;
        }
        else {
            const result = this.accumulatedTime;
            this.accumulatedTime = 0;
            return result;
        }
    }
}