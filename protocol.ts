export enum ProtocolCommandType {
    PING = 100,
    PONG = 101,
    GROUP_MESSAGE = 102
}


export class Protocol {
    private buffer: DataView
    public offset: number = 0

    constructor(buffer: DataView, offset: number = 0) {
        this.buffer = buffer
        this.offset = offset
    }

    public getBuffer(offset: number = 0): DataView {
        if (offset == 0) {
            return this.buffer
        }
        return new DataView(this.buffer.buffer, offset)
    }

    public decodeUint16Field(): number {
        let value = this.buffer.getUint16(this.offset)
        this.offset += 2
        return value
    }

    public decodeUint32Field(): number {
        let value = this.buffer.getUint32(this.offset)
        this.offset += 4
        return value
    }

    public decodeStringField(isVariableLength: boolean = true, realityLength: number = 0) {
        if (isVariableLength == true) {
            let realityLength = this.buffer.getUint16(this.offset)
            this.offset += 2
        }
        let value = '';
        for (let i = 0; i < realityLength; i++) {
            value += String.fromCharCode(this.buffer.getUint8(this.offset))
            this.offset++
        }

        return value
    }

    public encodeUint32Field(val: number): Protocol {
        this.buffer.setUint32(this.offset, val)
        this.offset += 4
        return this
    }

    public encodeUint16Field(val: number): Protocol {
        this.buffer.setUint16(this.offset, val)
        this.offset += 2
        return this
    }

    public encodeString(val: string, isVariableLength: boolean = true, realityLength: number = 0): Protocol {

        if (isVariableLength == true) {
            realityLength = val.length
        }

        this.buffer.setUint16(this.offset, realityLength)
        this.offset += 2

        for (let i = 0; i < realityLength; i++) {
            this.buffer.setUint8(this.offset, val[i].charCodeAt(0))
            this.offset++
        }

        return this
    }

    // bufferView.setUint8(offset, item.charCodeAt(0))
}

export enum MagicType {
    MAGIC_BASIC_PACKET = 123456789,
    MAGIC_LOGIC_PACKET = 987654321,
}

export enum BasicPktCodeType {
    Ping = 1,
    PONG = 2
}

export class BasicPkt {
    private magic: number = 0
    private code: number = 0
    private body: string = ''

    public setMagic(magic: number): BasicPkt {
        this.magic = magic
        return this
    }

    public setCode(code: number): BasicPkt {
        this.code = code
        return this
    }


    public getCode(): number {
        return this.code
    }

    public encode(): ArrayBuffer {
        let buffer = new ArrayBuffer(this.getArrayBufferLength())
        let proto = new Protocol(new DataView(buffer))
        proto.encodeUint32Field(MagicType.MAGIC_BASIC_PACKET)
        proto.encodeUint16Field(this.code)

        let bodyLength = this.body.length
        proto.encodeUint16Field(bodyLength)
        if (bodyLength > 0) {
            proto.encodeString(this.body)
        }

        return proto.getBuffer().buffer
    }

    public getArrayBufferLength(): number {
        let length = 0
        length += 4
        length += 2
        length += 2
        length += this.body.length
        return length
    }

    public decode(buf: DataView): BasicPkt {

        let proto = new Protocol(buf)
        this.code = proto.decodeUint16Field()
        this.body = proto.decodeStringField()

        return this
    }
}