import * as shp from "shapefile";
export {};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Usage: npm run import:shp -- <path-to-shp>");
  const source = await shp.open(filePath);
  let count = 0;
  let reading = true;
  while (reading) {
    const result = await source.read();
    if (result.done) {
      reading = false;
    } else {
      count++;
    }
  }
  console.log(`Read ${count} records from shapefile.`);
}

void main();
