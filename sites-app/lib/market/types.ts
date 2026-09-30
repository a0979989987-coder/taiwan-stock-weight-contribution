export type Weight = {rank:number;code:string;name:string;weight:number};
export type Stock = Weight & {close:number;previousClose:number;change:number;changePct:number;points:number};
export type DailyReport = {
  date:string;previousDate:string;weightDate:string;savedAt:string;
  index:{close:number;previousClose:number;change:number;changePct:number};
  stocks:Stock[]; totals:{positive:number;negative:number;net:number};
  methodology:string;sources:{current:string;previous:string;weights:string};
};
export type Attempt = {date:string;status:string;message:string;attempted_at:string};
export type MarketView = {report:DailyReport|null;dates:string[];latestDate:string|null;attempt:Attempt|null;today:string;canUpdate:boolean};
