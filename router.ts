import {BasicPkt, BasicPktCodeType} from "./protocol";

export class BasicController {

    public handler(basicPkt: DataView) {
        console.info(`<<<< basic packet`)

        let basic = new BasicPkt().decode(basicPkt)

        if (basic.getCode() == BasicPktCodeType.PONG) {
            this.Pong(basic)
        }
    }

    private Pong(basicPkt: BasicPkt) {
        console.info("<<<< received a pong...")
    }
}

