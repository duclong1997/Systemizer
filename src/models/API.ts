import { IDataOperator } from "src/interfaces/IDataOperator";
import { arrayEquals, sleep, UUID } from "src/shared/ExtensionMethods";
import { Connection } from "./Connection";
import { EndpointOperator, EndpointOptions } from "./EndpointOperator";
import { Endpoint, EndpointRef } from "./Endpoint";
import { APIType } from "./enums/APIType";
import { gRPCMode } from "./enums/gRPCMode";
import { EndpointActionHTTPMethod, HTTPMethod } from "./enums/HTTPMethod";
import { Protocol } from "./enums/Protocol";
import { Port } from "./Port";
import { RequestData, RequestDataHeader } from "./RequestData";

export class API extends EndpointOperator implements IDataOperator{

    inputPort: Port;
    connectionTable: { [id:string]: Connection } = {};
    options: APIOptions;
    color: string = "#4CA1AF";

    constructor() {
        super();
        this.inputPort = new Port(this, false, true);        
        this.outputPort = new Port(this, true, true);       
        this.options = new APIOptions(); 
        this.options.title = "API";
        let initialEndpoint = new Endpoint("api/posts", [HTTPMethod.GET,HTTPMethod.POST,HTTPMethod.PUT,HTTPMethod.DELETE,])
        initialEndpoint.protocol = Protocol.HTTP;
        this.options.endpoints = [
            initialEndpoint
        ];
    }

    async receiveData(data: RequestData, fromOutput:boolean) {
        if(fromOutput){
            // API received data from action 
            let targetConnection = this.connectionTable[data.responseId]
            this.fireReceiveData(data);
            if(targetConnection == null) 
                return;
            this.connectionTable[data.responseId] = null; // reset request id
        }
        else{
            // Null check
            if(data.requestId == "" || data.requestId == null) 
                throw new Error("Request ID can not be null");
            if(data.header.endpoint == null) 
                throw new Error("Endpoint can not be null")

            let targetEndpoint = this.getTargetEndpoint(data);
            if(targetEndpoint == null)
                return;

            this.fireReceiveData(data);
            this.requestReceived();


            if(this.connectionTable[data.requestId] != null){ // Check if the api is already streaming to this connection
                // Client sent data to stream
                if(data.header.stream == false && targetEndpoint.grpcMode != gRPCMode.Unary || targetEndpoint.protocol == Protocol.WebSockets) {// Client wants to end stream
                    this.connectionTable[data.requestId] = null;
                    this.requestProcessed();
                    return;
                }
            }
            else{
                this.connectionTable[data.requestId] = data.origin; // Save connection to request package
                if(data.header.stream){
                    if(targetEndpoint.grpcMode != gRPCMode.Unary || targetEndpoint.protocol == Protocol.WebSockets){
                        // Client wants to start stream
                        /*
                        This streaming process feels kinda clunky, it will be commented for now
                        this.stream(this.getResponse(data), targetEndpoint);
                        */
                        this.requestProcessed();
                        return;
                    }
                }
            }
          
            if(!await this.throttleThroughput(5000)){
                this.requestProcessed();
                return;
            }

            // Send data to every action
            for(let action of targetEndpoint.actions){
                // Get connection to given action endpoint
                let targetConnection: Connection;

                for(let connection of this.outputPort.connections){
                    let endpoints = connection.getOtherPort(this.outputPort).parent.getAvailableEndpoints();
                    if(action.endpoint != null && endpoints.find(endpoint => endpoint.url == action.endpoint.url && arrayEquals(endpoint.supportedMethods,action.endpoint.supportedMethods)) != null ){
                        targetConnection = connection;
                        break;
                    }
                }
                if(targetConnection == null)
                    continue;
                // Create new data package
                let request = new RequestData();
                let endpointRef = new EndpointRef();
                endpointRef.endpoint = action.endpoint;
                endpointRef.method = EndpointActionHTTPMethod[action.method] == "Inherit" ? data.header.endpoint.method : HTTPMethod[EndpointActionHTTPMethod[action.method]]
                request.header = new RequestDataHeader(endpointRef,action.endpoint.protocol);

                request.origin = targetConnection;
                request.originID = this.originID;
                request.requestId = UUID();

                if(action.asynchronous){
                    this.outputPort.sendData(request, targetConnection);
                }
                else{
                    await this.outputPort.sendData(request, targetConnection);
                    this.connectionTable[request.requestId] = request.origin;
                }
            }

            // Send response back to client
            this.requestProcessed();
            if(data.sendResponse)
                await this.sendData(this.getResponse(data));
        }
    }

    async sendData(response: RequestData) {
        let targetConnection = this.connectionTable[response.responseId] || response.origin;
        if(targetConnection == null)
            throw new Error("target connection is null");
        if(response.header.stream != true) // reset request id
            this.connectionTable[response.responseId] = null; 
        let res = await this.inputPort.sendData(response, targetConnection);
        if(!res && response.header.stream) // End the stream if sending data didn't success
            this.connectionTable[response.responseId] = null;
    }

    async stream(data: RequestData, streamingEndpoint: Endpoint){
        await sleep(700);
        if(this.connectionTable[data.responseId] == null ||(
            streamingEndpoint.grpcMode != gRPCMode["Server Streaming"] &&
            streamingEndpoint.grpcMode != gRPCMode["Bidirectional Streaming"] && 
            streamingEndpoint.protocol != Protocol.WebSockets) ||
            this.options.endpoints.indexOf(streamingEndpoint) == -1) return;
        await this.sendData(data);
        await this.stream(data, streamingEndpoint);
    }
}

export class APIOptions extends EndpointOptions{
    type: APIType = APIType.REST;
}