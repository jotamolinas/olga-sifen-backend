declare module 'pdfmake' {
  class PdfPrinter {
    constructor(fontDescriptors: Record<string, any>);
    createPdfKitDocument(
      docDefinition: any,
      options?: any
    ): any;
  }
  export default PdfPrinter;
}

declare module 'pdfmake/build/pdfmake' {
  const pdfMake: any;
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  export const pdfMake: any;
}
