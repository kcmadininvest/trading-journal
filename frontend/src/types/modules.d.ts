declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'p' | 'portrait' | 'l' | 'landscape';
    unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'ex' | 'em' | 'pc';
    format?: string | number[];
    compress?: boolean;
    precision?: number;
    userUnit?: number;
    hotfixes?: string[];
    compressPdf?: boolean;
  }

  export class jsPDF {
    constructor(options?: jsPDFOptions);
    constructor(
      orientation?: 'p' | 'portrait' | 'l' | 'landscape',
      unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'ex' | 'em' | 'pc',
      format?: string | number[],
      compressPdf?: boolean
    );
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: string,
      rotation?: number
    ): void;
    addPage(format?: string | number[], orientation?: 'p' | 'portrait' | 'l' | 'landscape'): void;
    save(filename: string, options?: { returnPromise?: boolean }): void;
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
  }
}


