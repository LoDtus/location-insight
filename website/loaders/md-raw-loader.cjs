module.exports = function mdRawLoader(source) {
    const text = typeof source === "string" ? source : source.toString();

    return `export default ${JSON.stringify(text)};`;
};
