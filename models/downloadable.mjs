export class Downloadable {
    path;

    constructor(path) {
        if(this.constructor === Downloadable) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        this.path = path;
    }
}