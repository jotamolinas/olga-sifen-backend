declare module 'facturacionelectronicapy-xmlgen' {
  const xmlgen: {
    generateXMLDE(params: any, data: any, options?: any): Promise<string>;
    [key: string]: any;
  };
  export default xmlgen;
  export = xmlgen;
}

declare module 'facturacionelectronicapy-xmlsign' {
  const xmlsign: {
    signXML(xml: string, certPathOrBuffer: string | Buffer, password: string, nativeEncoding?: boolean): Promise<string>;
    [key: string]: any;
  };
  export default xmlsign;
  export = xmlsign;
}

declare module 'facturacionelectronicapy-qrgen' {
  const qrgen: {
    generateQR(xmlSigned: string, idCSC: string | number, csc: string, env: string): Promise<string>;
    [key: string]: any;
  };
  export default qrgen;
  export = qrgen;
}

declare module 'facturacionelectronicapy-setapi' {
  const setApi: {
    recibe(id: number | string, xmlSigned: string, env: string, certPath: string, key: string): Promise<any>;
    recibeLote(id: number | string, xmlSigned: string, env: string, certPath: string, key: string): Promise<any>;
    consultaRuc(id: number | string, ruc: string, env: string, certPath: string, key: string): Promise<any>;
    consulta(id: number | string, cdc: string, env: string, certPath: string, key: string): Promise<any>;
    consultaLote(id: number | string, lote: string, env: string, certPath: string, key: string): Promise<any>;
    evento(id: number | string, xmlSigned: string, env: string, certPath: string, key: string): Promise<any>;
    [key: string]: any;
  };
  export default setApi;
  export = setApi;
}
