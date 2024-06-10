
class DateHandler {

    static getInverseDateString(date = new Date()) {
        let d = date.getUTCFullYear() + "-" +
            ("0" + (date.getUTCMonth()+1)).slice(-2) + "-" +
            ("0" + date.getUTCDate()).slice(-2) + "_" +
            ("0" + date.getUTCHours()).slice(-2) + "-" +
            ("0" + date.getUTCMinutes()).slice(-2) + "-" +
            ("0" + date.getUTCSeconds()).slice(-2) + "-" +
            ("0" + date.getUTCMilliseconds()).slice(-3);
        return d;
    }
}

export {DateHandler};