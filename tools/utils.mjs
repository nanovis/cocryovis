export function fileNameFilter(name) {
    return name.replace(/\s+/g, '_').replace(/[^\da-zA-Z_.]+/g, '');
}