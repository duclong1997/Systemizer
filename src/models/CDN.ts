import { IDataOperator } from "src/interfaces/IDataOperator";
import { Connection } from "./Connection";
import { EndpointOperator, EndpointOptions } from "./EndpointOperator";
import { Endpoint } from "./Endpoint";
import { HTTPMethod } from "./enums/HTTPMethod";
import { Port } from "./Port";
import { RequestData } from "./RequestData";

export class CDN extends EndpointOperator implements IDataOperator{

    inputPort: Port;
    options: CDNOptions;
    connectionTable: { [id:string]: Connection } = {};
    color = "#EB5757";

    constructor() {
        super();
        this.inputPort = new Port(this,false,true);      
        this.options = new CDNOptions();  
        this.options.title = "CDN";
        
        this.options.endpoints = [
            new Endpoint("/cdn",[HTTPMethod.GET,HTTPMethod.POST,HTTPMethod.PUT,HTTPMethod.DELETE,HTTPMethod.PATCH])    
        ]
    }

    async receiveData(data: RequestData) {
        let targetEndpoint = this.getTargetEndpoint(data);
        if(targetEndpoint == null)
            return;

        this.fireReceiveData(data);
        this.requestReceived();

        this.connectionTable[data.requestId] = data.origin;

        // Send response back
        this.requestProcessed();
        if(data.sendResponse)
            await this.sendData(this.getResponse(data));
    }

    async sendData(response: RequestData) {
        let targetConnection = this.connectionTable[response.responseId]
        if(targetConnection == null)
            throw new Error("Target connection can not be null");
        this.connectionTable[response.responseId] = null; // reset request id
        await this.inputPort.sendData(response, targetConnection);
    }
}

export class CDNOptions extends EndpointOptions{
}