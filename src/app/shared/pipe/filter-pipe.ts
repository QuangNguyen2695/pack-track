import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'filter'
})
export class FilterPipe implements PipeTransform {
    transform(items: any[], criteria: any): any {
        return items.filter(item => {
            for (let key in criteria) {
                if (item[key] !== criteria[key]) {
                    return false;
                }
            }
            return true;
        });
    }
}
