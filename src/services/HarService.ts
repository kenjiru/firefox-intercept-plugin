import * as _ from "lodash";
import {rowsStore} from "../model/RowsStore";
import FormattingUtils from "../utils/FormattingUtils";

export interface IRequestRow {
    key: number;
    name: string;
    url: string;
    method: string;
    status: number;
    type: string;
    size: number;
    sizeString: string;
    time: number;
    harEntry: any;
}

export default class HarService {
    public static handleRequests(): void {
        HarService.getInitialRequests();
        HarService.handleNewRequests();
    }

    private static handleNewRequests(): void {
        chrome.devtools.network.onRequestFinished.addListener(async (harEntry: any) => {
            const index: number = rowsStore.getRows().length;
            const requestRow: IRequestRow = await HarService.mapEntryToRow(harEntry, index);

            rowsStore.addSingleItem(requestRow);
        });
    }

    private static getInitialRequests(): void {
        setTimeout(() => {
            HarService.getRequestRows().then(rowsStore.addMultipleItems);
        }, 5000);
    }

    private static async getRequestRows(): Promise<IRequestRow[]> {
        const harLog: any = await HarService.getHarLog();
        const harEntries: any[] = harLog.entries;

        return await Promise.all(harEntries.map(HarService.mapEntryToRow));
    }

    private static getHarLog(): Promise<any> {
        return new Promise((resolve, reject) => {
            chrome.devtools.network.getHAR(resolve);
        });
    }

    private static async mapEntryToRow(entry: any, index: number): Promise<IRequestRow> {
        const time: number = Math.round(entry.time);
        const size: number = HarService.calculateSize(entry.response);

        entry.response.content.text = await HarService.getHarEntryContent(entry);

        return {
            key: index,
            name: HarService.getFileName(entry.request.url),
            url: entry.request.url,
            method: entry.request.method,
            status: entry.response.status,
            type: entry.response.content ? entry.response.content.mimeType : "",
            size,
            sizeString: HarService.formatSize(size),
            time,
            harEntry: entry,
        };
    }

    private static async getHarEntryContent(harEntry: any): Promise<any> {
        return new Promise((resolve, reject) => {
            harEntry.getContent(resolve);
        });
    }

    private static calculateSize(response): number {
        if (response.bodySize === 0 && response.headersSize === 0) {
            return 0;
        }

        if (response.bodySize < 0 && response.headersSize < 0) {
            return -1;
        }

        return response.bodySize + response.headersSize;
    }

    private static formatSize(size: number): string {
        if (size === 0) {
            return "From cache";
        }

        if (size === -1) {
            return "Not available";
        }

        if (size < 0) {
            return _.toString(size);
        }

        return FormattingUtils.formatBytes(size);
    }

    private static getFileName(path: string): string {
        return path.split("\\").pop().split("/").pop().substr(0, 20);
    }
}