type ZipEntry = {
  path: string;
  data: Buffer;
  crc32: number;
  offset: number;
};

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function uint16(value: number) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function uint32(value: number) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

export class ZipBuilder {
  private entries: ZipEntry[] = [];
  private localParts: Buffer[] = [];
  private offset = 0;
  private readonly createdAt: Date;

  constructor(createdAt = new Date()) {
    this.createdAt = createdAt;
  }

  addFile(path: string, content: Buffer | string) {
    const normalizedPath = path.replace(/^\/+/, "").replaceAll("\\", "/");
    const pathBuffer = Buffer.from(normalizedPath, "utf8");
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const checksum = crc32(data);
    const { time, day } = dosDateTime(this.createdAt);

    const header = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(time),
      uint16(day),
      uint32(checksum),
      uint32(data.length),
      uint32(data.length),
      uint16(pathBuffer.length),
      uint16(0),
      pathBuffer,
    ]);

    this.entries.push({
      path: normalizedPath,
      data,
      crc32: checksum,
      offset: this.offset,
    });
    this.localParts.push(header, data);
    this.offset += header.length + data.length;
  }

  toBuffer() {
    const { time, day } = dosDateTime(this.createdAt);
    const centralParts = this.entries.map((entry) => {
      const pathBuffer = Buffer.from(entry.path, "utf8");
      return Buffer.concat([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0x0800),
        uint16(0),
        uint16(time),
        uint16(day),
        uint32(entry.crc32),
        uint32(entry.data.length),
        uint32(entry.data.length),
        uint16(pathBuffer.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(entry.offset),
        pathBuffer,
      ]);
    });

    const centralDirectory = Buffer.concat(centralParts);
    const endRecord = Buffer.concat([
      uint32(0x06054b50),
      uint16(0),
      uint16(0),
      uint16(this.entries.length),
      uint16(this.entries.length),
      uint32(centralDirectory.length),
      uint32(this.offset),
      uint16(0),
    ]);

    return Buffer.concat([...this.localParts, centralDirectory, endRecord]);
  }
}
