export type DisplayImage={id:string;url:string;alt:string};
export type DisplayMediaResolver=(recordId:string)=>Promise<DisplayImage[]>;
export const noMedia:DisplayMediaResolver=async()=>[];
