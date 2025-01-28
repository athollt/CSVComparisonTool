import { Component, EventEmitter, Input, Output, OnInit, ViewChild, ViewEncapsulation, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTable, MatTableDataSource } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { ComparisonData, CsvRow, ModifiedRow } from '../../models/csv.model';
import { ColumnManagerComponent, ColumnDefinition } from '../column-manager/column-manager.component';

interface TableRow {
  [key: string]: string | number | CsvRow | ColumnChange[] | undefined;
  _status: 'added' | 'removed' | 'modified' | 'unchanged';
  _id: string;
  _original?: CsvRow;
  _changes?: ColumnChange[];
}

interface ColumnChange {
  column: string;
  oldValue: string | number;
  newValue: string | number;
}

@Component({
  selector: 'app-comparison-table',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatCheckboxModule,
    MatSortModule,
    MatPaginatorModule,
    ColumnManagerComponent
  ],
  template: `
    <div class="table-container mat-elevation-z2">
      <div class="table-header">
        <app-column-manager
          [columns]="visibleColumns"
          (columnsChange)="onColumnsChange($event)">
        </app-column-manager>
        
        <div class="selection-info" *ngIf="selection.hasValue()">
          <span class="status-modified">{{ selection.selected.length }}</span> rows selected
        </div>
      </div>

      <div class="table-scroll-container">
        <table mat-table [dataSource]="dataSource" matSort class="comparison-table">
          <!-- Checkbox Column -->
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef>
              <mat-checkbox
                [checked]="isAllSelected()"
                [indeterminate]="isIndeterminate()"
                (change)="$event ? toggleAllRows($event.checked) : null">
              </mat-checkbox>
            </th>
            <td mat-cell *matCellDef="let row">
              <mat-checkbox
                [checked]="selection.isSelected(row)"
                (change)="$event ? toggleRow(row) : null"
                [disabled]="row._status === 'unchanged'">
              </mat-checkbox>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let row">
              <span [class]="'status-' + row._status">
                {{ row._status | titlecase }}
              </span>
            </td>
          </ng-container>

          <!-- Data Columns -->
          <ng-container *ngFor="let column of displayedColumns">
            <ng-container [matColumnDef]="column">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ column }}</th>
              <td mat-cell *matCellDef="let row" [ngClass]="getCellClass(row, column)">
                {{ row[column] }}
                <span *ngIf="isModifiedCell(row, column)" class="change-indicator">
                  ({{ getOriginalValue(row, column) }})
                </span>
              </td>
            </ng-container>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="allDisplayedColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: allDisplayedColumns;"
              [ngClass]="getRowClass(row)"
              (click)="toggleRow(row)">
          </tr>
        </table>

        <mat-card class="no-data" *ngIf="!dataSource.data.length">
          <mat-card-content>
            <p>No comparison data available</p>
            <p class="sub-text">Upload CSV files to start comparing</p>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-paginator
        [pageSize]="10"
        [pageSizeOptions]="[5, 10, 25, 100]"
        showFirstLastButtons>
      </mat-paginator>
    </div>
  `,
  styles: [`
    .table-container {
      margin: 20px;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }

    .table-header {
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e0e0e0;
    }

    .table-scroll-container {
      max-height: calc(100vh - 300px);
      overflow: auto;
    }

    .comparison-table {
      width: 100%;
    }

    .status-added {
      color: #4caf50;
      font-weight: 500;
    }

    .status-removed {
      color: #f44336;
      font-weight: 500;
    }

    .status-modified {
      color: #ff9800;
      font-weight: 500;
    }

    .row-added {
      background-color: rgba(76, 175, 80, 0.1);
    }

    .row-removed {
      background-color: rgba(244, 67, 54, 0.1);
    }

    .row-modified {
      background-color: rgba(255, 152, 0, 0.1);
    }

    .cell-modified {
      position: relative;
    }

    .change-indicator {
      font-size: 0.8em;
      color: #666;
      margin-left: 4px;
    }

    .no-data {
      text-align: center;
      padding: 40px;
      background: #fafafa;
      margin: 20px;
    }

    .no-data .sub-text {
      color: #666;
      margin-top: 8px;
    }

    tr.mat-mdc-row {
      cursor: pointer;
    }

    tr.mat-mdc-row:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  `]
})
export class ComparisonTableComponent implements OnInit, AfterViewInit {
  @Input() set comparisonData(data: ComparisonData) {
    if (data) {
      this.processComparisonData(data);
    }
  }

  @Output() selectionChange = new EventEmitter<CsvRow[]>();

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatTable) table!: MatTable<TableRow>;

  dataSource: MatTableDataSource<TableRow>;
  selection = new SelectionModel<TableRow>(true, []);
  columnDefinitions: string[] = [];
  displayedColumns: string[] = [];
  allDisplayedColumns: string[] = ['select', 'status'];

  constructor() {
    this.dataSource = new MatTableDataSource<TableRow>([]);
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnInit() {
    this.selection.changed.subscribe(() => {
      this.selectionChange.emit(this.selection.selected as unknown as CsvRow[]);
    });
  }

  processComparisonData(data: ComparisonData) {
    const rows: TableRow[] = [];

    // Process added rows
    data.added.forEach(row => {
      const tableRow: TableRow = {
        ...row,
        _status: 'added',
        _id: this.generateRowId(row)
      };
      rows.push(tableRow);
    });

    // Process removed rows
    data.removed.forEach(row => {
      const tableRow: TableRow = {
        ...row,
        _status: 'removed',
        _id: this.generateRowId(row)
      };
      rows.push(tableRow);
    });

    // Process modified rows
    data.modified.forEach((modifiedRow: ModifiedRow) => {
      const tableRow: TableRow = {
        ...modifiedRow.modified,
        _status: 'modified',
        _id: this.generateRowId(modifiedRow.modified),
        _original: modifiedRow.original,
        _changes: modifiedRow.changes
      };
      rows.push(tableRow);
    });

    // Process unchanged rows
    data.unchanged.forEach(row => {
      const tableRow: TableRow = {
        ...row,
        _status: 'unchanged',
        _id: this.generateRowId(row)
      };
      rows.push(tableRow);
    });

    this.dataSource.data = rows;
    this.updateColumnDefinitions(rows);
  }

  updateColumnDefinitions(rows: TableRow[]) {
    if (rows.length) {
      const firstRow = rows[0];
      this.columnDefinitions = Object.keys(firstRow).filter(key => !key.startsWith('_'));
      this.displayedColumns = [...this.columnDefinitions];
      this.allDisplayedColumns = ['select', 'status', ...this.displayedColumns];
    }
  }

  onColumnsChange(columns: ColumnDefinition[]) {
    this.displayedColumns = columns.filter(col => col.visible).map(col => col.name);
    this.allDisplayedColumns = ['select', 'status', ...this.displayedColumns];
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.filter(row => row._status !== 'unchanged').length;
    return numSelected === numRows;
  }

  isIndeterminate() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.filter(row => row._status !== 'unchanged').length;
    return numSelected > 0 && numSelected < numRows;
  }

  toggleAllRows(checked: boolean) {
    if (checked) {
      const selectableRows = this.dataSource.data.filter(row => row._status !== 'unchanged');
      this.selection.select(...selectableRows);
    } else {
      this.selection.clear();
    }
  }

  toggleRow(row: TableRow) {
    if (row._status !== 'unchanged') {
      this.selection.toggle(row);
    }
  }

  getRowClass(row: TableRow): string {
    return `row-${row._status}`;
  }

  getCellClass(row: TableRow, column: string): string {
    if (row._status === 'modified' && row._changes) {
      const change = row._changes.find(c => c.column === column);
      if (change) {
        console.log(`Modified cell found for column ${column}:`, change); // Debug log
        return 'modified-cell';
      }
    }
    return '';
  }

  isModifiedCell(row: TableRow, column: string): boolean {
    return row._status === 'modified' && 
           row._changes?.some(change => change.column === column) || false;
  }

  getOriginalValue(row: TableRow, column: string): any {
    if (row._status === 'modified' && row._original) {
      return (row._original as any)[column];
    }
    return null;
  }

  private generateRowId(row: CsvRow): string {
    const firstKey = Object.keys(row)[0];
    return (row as any)[firstKey]?.toString() || Math.random().toString(36).substr(2, 9);
  }

  get visibleColumns(): ColumnDefinition[] {
    return this.columnDefinitions.map(col => ({
      name: col,
      visible: this.displayedColumns.includes(col)
    }));
  }
}
