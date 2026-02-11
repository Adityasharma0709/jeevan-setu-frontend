import { computed, Directive, ElementRef, inject, input, linkedSignal } from '@angular/core';
import type { ClassValue } from 'clsx';
import { mergeClasses, transform } from '@/shared/utils/merge-classes';

import {
    inputVariants,
    type ZardInputSizeVariants,
    type ZardInputStatusVariants,
} from './input.variants';

@Directive({
    selector: 'select[z-input]',
    host: {
        '[class]': 'classes()',
    },
    exportAs: 'zSelect',
})
export class ZardSelectDirective {
    private readonly elementRef = inject(ElementRef);

    readonly class = input<ClassValue>('');
    readonly zBorderless = input(false, { transform });
    readonly zSize = input<ZardInputSizeVariants>('default');
    readonly zStatus = input<ZardInputStatusVariants>();

    readonly size = linkedSignal<ZardInputSizeVariants>(() => this.zSize());

    protected readonly classes = computed(() =>
        mergeClasses(
            inputVariants({
                zType: 'default',
                zSize: this.size(),
                zStatus: this.zStatus(),
                zBorderless: this.zBorderless(),
            }),
            this.class(),
            // Ensure select has consistent height/padding if needed, 
            // though 'default' input variant usually works well.
        ),
    );
}
