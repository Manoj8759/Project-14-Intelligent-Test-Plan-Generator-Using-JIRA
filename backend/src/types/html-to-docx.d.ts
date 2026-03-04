declare module 'html-to-docx' {
  interface HTMLtoDOCXOptions {
    table?: {
      row?: {
        cantSplit?: boolean;
      };
    };
    footer?: boolean;
    pageNumber?: boolean;
    [key: string]: any;
  }

  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString: string | null,
    options?: HTMLtoDOCXOptions
  ): Promise<Buffer>;

  export = HTMLtoDOCX;
}
