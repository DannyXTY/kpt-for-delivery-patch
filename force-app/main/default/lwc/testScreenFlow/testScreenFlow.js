import { LightningElement, track } from 'lwc';
import { FlowNavigationNextEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { loadScript } from 'lightning/platformResourceLoader';

export default class TestScreenFlow extends LightningElement {
    showFlow = false;
    get inputVariables() {
        return [

        ];
    }

    handleStartFlow() {
        this.showFlow = true; // set to true when button clicked
    }

    handleStatusChange(event) {
        console.log("event.detail.status")
        console.log(event.detail.status)
        if (event.detail.status === 'FINISHED') {
            // The flow finished successfully.
            // You can grab output variables here if needed:
            const outputVariables = event.detail.outputVariables;
            console.log(outputVariables)
            this.showFlow = false;
            console.log('Flow Finished!');
            // Action: Close modal or refresh view
        }
    }
}